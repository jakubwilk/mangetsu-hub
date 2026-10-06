import { config } from 'dotenv'

// Import first: modules such as server/db read process.env as soon as they are imported.
// Local development keeps its variables in .env.local; in production they come from Coolify.
config({ path: ['.env.local', '.env'], quiet: true })
