import fs from 'fs-extra';
import path from 'path';
import PromiseFtp from 'promise-ftp';

const host = process.env.TARGET_HOST || 'ftp';
const port = process.env.TARGET_PORT || '21';
const user = process.env.TARGET_USERNAME;
const password = process.env.TARGET_PASSWORD;
const targetFolder = process.env.TARGET_FOLDER || '/';

const uploadFile = async function(file) {
  const fileName = path.join(targetFolder, path.basename(file));

  if (!user) {
    console.log(`No FTP credentials configured. Skipping file upload of ${fileName}.`);
    return;
  }

  console.log(`Trying to connect to FTP at ${host}:${port}.`);
  const ftp = new PromiseFtp();
  try {
    await ftp.connect({
      host,
      port,
      user,
      password
    });
    console.log(`Uploading ${fileName} through FTP at ${host}:${port}.`);
    await ftp.put(file, fileName);
    await ftp.end();
  } catch (e) {
    console.log(`Something went wrong while uploading ${fileName} through FTP at ${host}:${port}: ${e.message || e.error || e}`);
  }
};

export {
  uploadFile
}
