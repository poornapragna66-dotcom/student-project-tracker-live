import express from 'express';
import { createApp } from './project-api.js';
import { db } from './database.js';
const app = express();
app.use(createApp(db));
export default app;
