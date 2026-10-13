import { createApp } from './app.factory.js';
import { ENV, type Env } from './config/env.js';

const app = await createApp();
const env = app.get<Env>(ENV);
await app.listen({ host: env.HOST, port: env.PORT });
