# toezicht-inzending-reporting-service

Microservice to generate reports about the inzendingen voor toezicht. A cron job is embedded in the service to trigger the generation of the reports at the preconfigured frequency. Reports are available in `/data/output`.

The service generates 2 CSV reports:
* A list of the inzendingen voor toezicht submitted yesterday
* A list of the inzendingen voor toezicht submitted during a preconfigured period (see `CURRENT_PERIOD_START` and `CURRENT_PERIOD_END` environment variables in the Configuration-section).

## Installation
To add the service to your stack, add the following snippet to `docker-compose.yml`:
```
services:
  toezichtreporting:
    image: lblod/toezicht-inzending-reporting-service:0.3.2
    volumes:
      - ./data/reports:/data/output
```

Don't forget to update the dispatcher configuration to route requests to the export service.

## Configuration
### Environment variables
The following environment variables can be configured:
* `CRON_PATTERN`: cron pattern to configure the frequency of the cron job. The pattern follows the format as specified in [node-cron](https://www.npmjs.com/package/cron#available-cron-patterns). Defaults to `0 0 0 2 * *`, run every day at 2 a.m.
* `CURRENT_PERIOD_START`: start date of the time period to filter on. Format: `YYYY-MM-DD`. Default: `2012-01-01`.
* `CURRENT_PERIOD_END`: end date of the time period to filter on. Format: `YYYY-MM-DD`. Default: `2019-01-01`.
* `DOMAIN_URL`: Base URL used to generate the links to view the inzendingen (e.g. http://loket.lokaalbestuur.vlaanderen.be)

Optionally, enviroment variables can be set to upload the generated reports through FTP. The upload will only happen if `TARGET_USERNAME` has been configured.

* `TARGET_HOST`: optional, default `'ftp'`
* `TARGET_PORT`: optional, default `'21'`
* `TARGET_USERNAME`: required to enable the FTP upload
* `TARGET_PASSWORD`: optional
* `TARGET_FOLDER`: optional, default `/`

## REST API
### POST /report-tasks
Trigger a new report task asynchronously.

Returns `202 Accepted` if the report generation started successfully. The location response header contains an endpoint to monitor the task status.

Returns `503 Service Unavailable` if a report task is already running.

### GET /report-tasks/:id
Get the status of a report task.

Returns `200 OK` with a task resource in the response body. Task status is one of `ongoing`, `done`, `cancelled` or `failed`.

## Development
Add the following snippet to your stack during development:
```
services:
  toezichtreporting:
    image: semtech/mu-javascript-template:1.3.2
    ports:
      - 8888:80
    environment:
      NODE_ENV: "development"
    volumes:
      - /path/to/your/code:/app/
      - ./data/reports:/data/output
```
