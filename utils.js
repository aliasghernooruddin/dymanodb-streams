const http = require('http');
const https = require('https');
const fs = require('fs');
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const path = require("path");
const CloudConvert = require('cloudconvert');
const dotenv = require('dotenv');
const AWS = require('aws-sdk'); // not needed on lambda 
const axios = require('axios').default;
const TABLE_NAME = 'CertsDynamodbTable';

dotenv.config();

const CLOUD_CONVERT_API_KEY = process.env.CLOUD_CONVERT_KEY
const AWS_REGION = process.env.AWS_REGION
const S3_BUCKET = process.env.S3_BUCKET

const cloudConvert = new CloudConvert(CLOUD_CONVERT_API_KEY);

const ddb = new AWS.DynamoDB.DocumentClient({ region: "us-east-1" });

//------ s3 config (not needed on labmda )
const s3 = new AWS.S3({ apiVersion: '2006-03-01', region: AWS_REGION });
s3.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY
});

const downloadTemplate = function downloadFileUsingS3(link) {

    return new Promise(resolve => {
        const file = fs.createWriteStream('cerTemp.pptx');
        const request = http.get(link, function (response) {
            response.pipe(file);

            // after download completed close filestream
            file.on("finish", () => {
                file.close();
                console.log("Download Completed");
                resolve()
            });
        });
    })
}

const modifyTemplate = function modifyTemplate(filename, data) {
    return new Promise(resolve => {
        // Load the docx file as binary content
        const content = fs.readFileSync(
            path.resolve(__dirname, filename),
            "binary"
        );

        const zip = new PizZip(content);

        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        doc.render({
            UserName: data.UserName,
            WebinarName: data.WebinarName,
            Duration: data.Duration,
            Date: data.Date,
        });

        const buf = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE",
        });


        fs.writeFileSync(path.resolve(__dirname, "output.pptx"), buf);
        resolve()
    })
}

const cloudConvertToPDF = function cloudConvertToPDF(File) {

    return new Promise(async function (resolve, reject) {
        await cloudConvert.jobs.create({
            "tasks": {
                'upload-my-file': {
                    operation: 'import/upload'
                },
                "Convert2pdf": {
                    "operation": "convert",
                    "input": [
                        "upload-my-file"
                    ],
                    "output_format": "pdf",
                    "engine": "libreoffice",
                    "pages": "1"
                },
                "export2url": {
                    "operation": "export/url",
                    "input": [
                        "Convert2pdf"
                    ],
                    "inline": true,
                    "archive_multiple_files": false
                }
            },
            "tag": "jobbuilder"
        }).then(async function (Job) {
            console.log("Starting First Job")
            let uploadTask = Job.tasks.find(task => task.name === 'upload-my-file');
            let inputFile = fs.createReadStream(`${File}`);
            await cloudConvert.tasks.upload(uploadTask, inputFile, File);
            return Job;
        }).then(async function (JobAfterUpload) {
            console.log("JobAfterUpload.id >>> ", JobAfterUpload.id);
            let PDFURL = await cloudConvertGetURL(JobAfterUpload.id);
            resolve(PDFURL);
        }).catch(function (e) {
            console.error("Error2::", e.toString());
            reject(e.toString());
        });
    })

}

const cloudConvertGetURL = function cloudConvertGetURL(JobID) {

    return new Promise(async function (resolve, reject) {
        let TaskURL = new URL(`https://sync.api.cloudconvert.com/v2/jobs/${JobID}`);

        var options = {
            "method": "GET",
            "hostname": TaskURL.hostname,
            "port": null,
            "path": TaskURL.pathname,
            "headers": {
                "authorization": `Bearer ${CLOUD_CONVERT_API_KEY}`,
                "cache-control": "no-cache",
            }
        };

        try {
            let idx = setInterval(function () {
                var req = https.request(options, function (res) {
                    var chunks = [];
                    res.on("data", function (chunk) {
                        chunks.push(chunk);
                    });
                    res.on("end", function () {
                        let previewUrl = null
                        var body = JSON.parse((Buffer.concat(chunks)).toString());
                        let newjob = body.data.tasks.filter(function (el) {
                            return el.name == 'export2url';
                        });
                        if (typeof JobID !== 'undefined' && typeof newjob !== 'undefined' && newjob && previewUrl == null && newjob[0].result != null) {
                            previewUrl = newjob[0].result.files[0].url;
                            clearInterval(idx);
                            resolve(previewUrl);
                        }
                    });
                });
                req.end();
            }, 500); // the interval when to call the function again 500ms = 0.5sek 
        } catch (e) {
            console.log(e.toString());
            reject(e.toString());
        }
    });
}

const uploadToS3 = async function uploadToS3(url, generalInfo, username) {

    let type = 'application/pdf';

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer'
        });
        let buffer = Buffer.from(response.data, 'base64');
        return await (async () => {
            var params = {
                Key: `certs-${generalInfo.platform}/${generalInfo.service_id}/${generalInfo.user_id}-${username}.pdf`,
                Body: buffer,
                Bucket: S3_BUCKET,
                ContentType: type,
                ACL: 'public-read' //becomes a public URL
            };

            //notice use of the upload function, not the putObject function
            return s3.upload(params).promise().then((response_1) => {
                return response_1.Location;
            }, (err) => {
                return { type: 'error', err: err };
            });
        })();
    } catch (err_1) {
        console.log(err_1);
        return { type: 'error', err: err_1 };
    }
}

const addCertificateToDB = function AddCertsInfoToCertDynmoDB(CertsId, CertInfo) {
    var params = {
        TableName: TABLE_NAME,
        Key: {
            "CertsId": CertsId
        },
        UpdateExpression: "SET CertStatus = :CertStatus, GeneratedCertInfo = :GeneratedCertInfo",
        ExpressionAttributeValues:
        {
            ":GeneratedCertInfo": CertInfo,
            ":CertStatus": "generated"
        },
        ReturnValues: "UPDATED_NEW"
    };
    return ddb.update(params).promise();
}

const saveToLocalDB = async function saveToDB(json_requests, DBClientHost, DBBearerAuthToken) {
    return new Promise(async function (resolve, reject) {
        let headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": DBBearerAuthToken
        };
        await axios.post(`${DBClientHost}/api/v0.9.2/MC-1848/add-certificates`, json_requests, { headers: headers })
            .then((response) => {
                resolve("Save to Database status::", response);
            })
            .catch(err => {
                reject({ type: 'error', err: err });
            });

    });
}

module.exports = {
    downloadTemplate, modifyTemplate, cloudConvertToPDF, uploadToS3, addCertificateToDB, saveToLocalDB
}