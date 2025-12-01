import fs from 'fs/promises';
import path from 'path';

const API_KEY = process.env.JULES_API_KEY;
if (!API_KEY) {
  console.error("JULES_API_KEY is not set.");
  process.exit(1);
}

const BASE_URL = 'https://jules.googleapis.com/v1alpha';
const OUTPUT_DIR = 'samples';

async function fetchAll(urlStr, key) {
  let items = [];
  let pageToken = null;
  do {
    const u = new URL(urlStr);
    if (pageToken) {
      u.searchParams.set('pageToken', pageToken);
    }
    // console.log(`Fetching ${u.toString()}...`);
    const response = await fetch(u.toString(), {
      headers: { 'X-Goog-Api-Key': API_KEY }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch ${urlStr}: ${response.status} ${response.statusText}\n${text}`);
    }

    const data = await response.json();
    const batch = data[key] || [];
    items = items.concat(batch);
    pageToken = data.nextPageToken;
    process.stdout.write('.');
    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  } while (pageToken);
  process.stdout.write('\n');

  return { [key]: items };
}

async function fetchOne(urlStr) {
    console.log(`Fetching ${urlStr}...`);
    const response = await fetch(urlStr, {
        headers: { 'X-Goog-Api-Key': API_KEY }
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch ${urlStr}: ${response.status} ${response.statusText}\n${text}`);
    }
    return await response.json();
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  try {
    // 1. Fetch Sources
    console.log("Downloading sources...");
    const sourcesData = await fetchAll(`${BASE_URL}/sources`, 'sources');
    await fs.writeFile(path.join(OUTPUT_DIR, 'sources_list.json'), JSON.stringify(sourcesData, null, 2));

    // 2. Fetch Sessions
    console.log("Downloading sessions...");
    const sessionsData = await fetchAll(`${BASE_URL}/sessions`, 'sessions');
    await fs.writeFile(path.join(OUTPUT_DIR, 'sessions_list.json'), JSON.stringify(sessionsData, null, 2));

    // 3. Filter for 3 most recent COMPLETED sessions
    const sessions = sessionsData.sessions || [];
    const completedSessions = sessions
        .filter(s => s.state === 'COMPLETED')
        .sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime))
        .slice(0, 3);

    console.log(`Found ${completedSessions.length} completed sessions.`);

    for (const session of completedSessions) {
        console.log(`Downloading details for session: ${session.name} (${session.id})`);

        // Session Detail
        const sessionDetailUrl = `${BASE_URL}/${session.name}`;
        const sessionDetail = await fetchOne(sessionDetailUrl);
        await fs.writeFile(path.join(OUTPUT_DIR, `session_${session.id}_detail.json`), JSON.stringify(sessionDetail, null, 2));

        // Activities
        console.log(`Downloading activities for session: ${session.name}`);
        const activitiesUrl = `${BASE_URL}/${session.name}/activities`;
        const activitiesData = await fetchAll(activitiesUrl, 'activities');
        await fs.writeFile(path.join(OUTPUT_DIR, `session_${session.id}_activities.json`), JSON.stringify(activitiesData, null, 2));
    }

    console.log("Done!");

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
