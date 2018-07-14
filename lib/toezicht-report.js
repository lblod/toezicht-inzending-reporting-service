import path from 'path';
import fs from 'fs-extra';
import { uuid, sparqlEscapeString, sparqlEscapeUri, sparqlEscapeInt, sparqlEscapeDateTime } from 'mu';
import { updateSudo as update } from './auth-sudo';

class ToezichtReport {
  constructor(content) {
    for( var key in content )
      this[key] = content[key];
  }
}

/**
 * Insert (the metadata of) a new toezicht report
 *
 * @param {string} filename Name of the toezicht report file
 * @param {string} format MIME type of the toezicht report file
 *
 * @return {ToezichtReport} A new toezicht report
 */
async function insertNewToezichtReport(file, format) {
  const id = uuid();
  const uri = `http://mu.semte.ch/services/toezicht-inzending-reporting-service/reports/${id}`;
  const created = new Date();
  const filename = path.basename(file);
  const stats = await fs.stat(file);
  const size = stats.size;
  
  await update(
    `PREFIX report: <http://mu.semte.ch/vocabularies/ext/supervision/reporting/>
     PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
     PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
     PREFIX dct: <http://purl.org/dc/terms/>

     INSERT DATA { 
       GRAPH <http://mu.semte.ch/graphs/public> {
           ${sparqlEscapeUri(uri)} a report:Report, nfo:FileDataObject ; 
                mu:uuid ${sparqlEscapeString(id)} ;
                nfo:filename ${sparqlEscapeString(filename)} ;
                dct:format ${sparqlEscapeString(format)} ;
                nfo:fileSize ${sparqlEscapeInt(size)} ;
                dct:created ${sparqlEscapeDateTime(created)} .
       }
     }`);

  return new ToezichtReport({
    uri,
    id,
    format,
    size,
    created
  });
}

export default ToezichtReport;
export { insertNewToezichtReport };
