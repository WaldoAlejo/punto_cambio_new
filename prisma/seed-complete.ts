import { existsSync } from 'fs';

const candidates = ['seed.ts', 'seed-admin.ts', 'seed-production.ts'];

async function run() {
  for (const file of candidates) {
    const fileUrl = new URL(`./${file}`, import.meta.url);
    if (existsSync(fileUrl)) {
      console.log(`Running ${file}...`);
      try {
        // dynamic import so tsx can load TS files
        await import(fileUrl.href);
      } catch (err) {
        console.error(`Error running ${file}:`, err);
        throw err;
      }
    } else {
      console.log(`Not found: ${file}`);
    }
  }
}

run()
  .then(() => {
    console.log('Seed complete finished.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed complete failed:', err);
    process.exit(1);
  });
