import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/db.js';

const port = Number(process.env.PORT || 5000);
try {
  await connectDatabase(process.env.MONGODB_URI);
  app.listen(port, () => console.log(`ScamScan API listening on http://localhost:${port}`));
} catch (error) {
  console.error(`Database connection failed: ${error.message}`);
  process.exit(1);
}
