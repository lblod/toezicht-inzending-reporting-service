import fs from 'fs-extra';
import request from 'request';
import eventStream from 'event-stream';

const batchSize = 1000;

/**
 * Export CSV to a file based on a SELECT-query
 *
 * @param {string} file Absolute path of the file to export to (e.g. /data/exports/toezicht-inzendingen.csv)
*/
async function queryCsv(query, file, lineTransform) {
  const tmpFile = `${file}.tmp`;

  let offset = 0;

  let hasNext = true;
  while (hasNext) {
    hasNext = await appendBatch(tmpFile, query, offset, batchSize, offset == 0, lineTransform);
    offset = offset + batchSize;
    console.log(`${offset} CSV records processed`);
  }

  await fs.rename(tmpFile, file);
}

// private

async function appendBatch(file, query, offset = 0, limit = 1000, writeColumnHeader = false, lineTransform) {
  const format = 'text/csv';
  const pagedQuery = `${query} LIMIT ${limit} OFFSET ${offset}`;
  const options = {
    method: 'POST',
    url: process.env.MU_SPARQL_ENDPOINT,
    headers: {
      'Accept': format
    },
    qs: {
      format: format,
      query: pagedQuery
    }
  };

  console.log(`SPARQL query: ${pagedQuery}`);
  let lineNb = 0;
  let nbOfRecords = 0;
  await new Promise(resolve =>
                    request(options)
                    .on('response', function(response) {
                      if (response && response.statusCode / 100 != 2)
                        throw new Error(`SPARQL query failed`);
                    })
                    .on('error', (error) => { throw error; })
                    .pipe(eventStream.split())
                    .pipe(eventStream.map(function (line, callback) {
                      if (lineNb == 0 && !writeColumnHeader) {
                        callback(); // skip first line
                      } else if (!line.length) {
                        callback(); // skip empty lines
                      } else {
                        if (lineNb == 0)
                          line = line.replace(/_/g, ' '); // humanize header column labels
                        else if (lineNb > 0 && lineTransform) {
                          let values = [];
                          // Fancy regex to split on ',' without splitting on ',' inside string values
                          const reg = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
                          let match;
                          while ((match = reg.exec(line))) { // reg.lastIndex keeps track of position
                            values.push(match[1]);
                          }
                          values = lineTransform(values);
                          line = values.join(',');
                        }
                        callback(null, `${line}\n`);
                        nbOfRecords++;
                      }
                      lineNb++;
                    }))
                    .pipe(fs.createWriteStream(file, { flags: 'a' }))
                    .on('finish', resolve));
  return nbOfRecords > 0;
}

export default queryCsv;
export { queryCsv };
