import { uuid, sparqlEscapeString, sparqlEscapeUri } from 'mu';
import fs from 'fs-extra';
import { queryCsv } from './query-csv';
import { querySudo as query, updateSudo as update } from './auth-sudo';

const outputDir = '/data/output';
const queryFile = '/app/sparql-queries/inzendingen-in-periode.sparql';
const fileBase = process.env.REPORT_FILE_BASE || 'toezicht-inzendingen';
const currentPeriodStart = process.env.CURRENT_PERIOD_START || "2012-01-01";
const currentPeriodEnd = process.env.CURRENT_PERIOD_END || "2019-01-01";

const generateCsvReportYesterday = async function() {
  const yesterday = new Date(Date.now() - 86400000); // 24 * 60 * 60 * 1000
  yesterday.setHours(0, 0, 0, 0);
  const today = new Date(Date.now());
  today.setHours(0, 0, 0, 0);

  const file = `${outputDir}/${fileBase}-${yesterday.toISOString().substr(0, 10)}.csv`;
  let query = await fs.readFile(queryFile, 'utf8');
  query = query.replace('{START}', yesterday.toISOString());
  query = query.replace('{END}', today.toISOString());
  await queryCsv(query, file);
};

const generateCsvReportForCurrentPeriod = async function() {
  const start = new Date(Date.parse(currentPeriodStart));
  const end = new Date(Date.parse(currentPeriodEnd));

  const file = `${outputDir}/${fileBase}-huidige-bestuursperiode.csv`;
  let query = await fs.readFile(queryFile, 'utf8');
  query = query.replace('{START}', start.toISOString());
  query = query.replace('{END}', end.toISOString());
  await queryCsv(query, file);
};

class ReportTask {
  // uri: null;
  // id: null;
  // status: null;
  constructor(content) {
    for( var key in content )
      this[key] = content[key];
  }

  /**
   * Reporting to perform
   *
   * @method perform
   */
  async perform() {
    console.log(`Start task ${this.id}`);
    try {
      await generateCsvReportYesterday();
      await generateCsvReportForCurrentPeriod();

      console.log(`Finish task ${this.id}`);
      await finishTask(this.id);
    } catch(err) {
      console.log(`Reporting failed: ${err}`);
      await finishTask(this.id, true);
    }
  }

  /**
   * Wrap report-task in a JSONAPI compliant object
   *
   * @method toJsonApi
   * @return {Object} JSONAPI compliant wrapper for the report-task
   */
  toJsonApi() {
    return {
      data: {
        type: 'report-tasks',
        id: this.id,
        attributes: {
          uri: this.uri,
          status: this.status
        }
      }
    };
  }

}

/**
 * Insert a new report task
 *
 * @return {ReportTask} A new report task
 */
async function insertNewTask() {
  const taskId = uuid();
  const taskUri = `http://mu.semte.ch/services/toezicht-inzendingen-reporting-service/tasks/${taskId}`;
  await update(
    `PREFIX report: <http://mu.semte.ch/vocabularies/ext/supervision/reporting/>
     PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

     INSERT DATA {
       GRAPH <http://mu.semte.ch/graphs/public> {
           ${sparqlEscapeUri(taskUri)} a report:Task ;
                mu:uuid ${sparqlEscapeString(taskId)} ;
                report:status "ongoing" .
       }
     }`);

  return new ReportTask({
    uri: taskUri,
    id: taskId,
    status: "ongoing"
  });
}

/**
 * Finish task with the given uuid
 *
 * @param {string} uuid uuid of the report task
 * @param {boolean} failed whether the task failed to finish
 */
async function finishTask(uuid, failed = false) {
  const status = failed ? "failed" : "done";
  await update(
    `PREFIX report: <http://mu.semte.ch/vocabularies/ext/supervision/reporting/>
     PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

     WITH <http://mu.semte.ch/graphs/public>
     DELETE {
       ?s report:status ?status .
     }
     INSERT {
       ?s report:status ${sparqlEscapeString(status)} .
     } WHERE {
       ?s a report:Task ;
            mu:uuid ${sparqlEscapeString(uuid)} ;
            report:status ?status .
     }`);
}

/**
 * Cleanup ongoing tasks
*/
async function cleanup() {
  await update(
    `PREFIX report: <http://mu.semte.ch/vocabularies/ext/supervision/reporting/>
     PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

     WITH <http://mu.semte.ch/graphs/public>
     DELETE {
       ?s report:status ?status .
     }
     INSERT {
       ?s report:status "cancelled" .
     } WHERE {
       ?s a report:Task ;
            report:status ?status .

       FILTER(?status = "ongoing")
     }`);
}

/**
 * Get a report task by uuid
 *
 * @param {string} uuid uuid of the report task
 *
 * @return {Report} Report task with the given uuid. Null if not found.
*/
async function reportTaskByUuid(uuid) {
  const queryResult = await query(
    `PREFIX report: <http://mu.semte.ch/vocabularies/ext/supervision/reporting/>
     PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

     SELECT *
     WHERE {
       GRAPH <http://mu.semte.ch/graphs/public> {
         ?uri a report:Task ;
              mu:uuid ${sparqlEscapeString(uuid)} ;
              report:status ?status .
       }
     }`);

  if (queryResult.results.bindings.length) {
    const result = queryResult.results.bindings[0];
    return new ReportTask({
      uri: result.uri.value,
      id: uuid,
      status: result.status.value
    });
  } else {
    return null;
  }
}

/**
 * Returns whether a report task is currently running
 * @return {boolean} Whether a report task is currently running
*/
async function isRunning() {
  const queryResult = await query(
    `PREFIX report: <http://mu.semte.ch/vocabularies/ext/supervision/reporting/>
     PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

     ASK {
       GRAPH <http://mu.semte.ch/graphs/public> {
         ?uri a report:Task ;
              report:status "ongoing" .
       }
     }`);

  return queryResult.boolean;
}

export default ReportTask;
export {
  insertNewTask,
  finishTask,
  reportTaskByUuid,
  isRunning,
  cleanup
};
