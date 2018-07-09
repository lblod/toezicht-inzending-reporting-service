import { app, errorHandler } from 'mu';
import { CronJob } from 'cron';
import request from 'request';
import { reportTaskByUuid, insertNewTask, isRunning, cleanup } from './lib/report-task';

/** Run on startup */
cleanup();

/** Schedule cron job */
const cronFrequency = process.env.CRON_PATTERN || '0 0 */2 * * *';
new CronJob(cronFrequency, function() {
  console.log(`Toezicht inzendingen reporting triggered by cron job at ${new Date().toISOString()}`);
  request.post('http://localhost/report-tasks');
}, null, true);


/**
 * Triggers an async report task for the toezicht inzendingen and writes the report files in /data/reports
 * 
 * @return [202] if report task started successfully. Location header contains an endpoint to monitor the task status
 * @return [503] if a report task is already running
*/
app.post('/report-tasks', async function(req, res, next) {
  if (await isRunning())
    return res.status(503).end();

  try {
    const task = await insertNewTask();

    task.perform(); // don't await this call since the reporting is executed asynchronously
  
    return res.status(202).location(`/report-tasks/${task.id}`).end();
  } catch(e) {
    return next(new Error(e.message));
  }
});

/**
 * Get the status of a task
 * 
 * @return [200] with task status object
 * @return [404] if task with given id cannot be found
*/
app.get('/report-tasks/:id', async function(req, res) {
  const taskId = req.params.id;
  const reportTask = await reportTaskByUuid(taskId);

  if (reportTask) {
    return res.send(reportTask.toJsonApi());
  } else {
    return res.status(404).end();
  }
});

app.use(errorHandler);

