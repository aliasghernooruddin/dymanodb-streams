const AWS = require('aws-sdk');
// const DDB = new AWS.DynamoDB({apiVersion: '2012-08-10'});
const TABLE_NAME = 'CertsDynamodbTable';
const ddb = new AWS.DynamoDB.DocumentClient({ region: "us-east-1" });


const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const fs = require("fs");
// const {resolve} = require("path");  
// // var convertapi = require('convertapi')('ioO2KDh16hlxPCwe'); 
const axios = require('axios').default;
const https = require('https');
var aws = require('aws-sdk'); // not needed on lambda 
let globalEventBody;
let CertsId;
let BearerAuthToken;
let ClientHost;
const CLUDCONVERT_API_KEY = '';
// get cloudconvert client
const cloudConvert = new (require('cloudconvert'))(CLUDCONVERT_API_KEY);
let CertGeneralInfo;

/* (CertStatus) status meaning :
      "pending" ==> the record is just added and waiting to be proccessed.
      "processing" ==> the certs is curently under proccessing.
      "failed" ==> the certs generating is failed.
      "generated" ==> the certs generating is succeed.
      "done" ==> the certs info is sent successfully to the clients DB
*/
exports.handler = async (event) => {
  console.log(JSON.stringify(event));
  console.log("Number of recors in this event is ", event.Records.length);
  let RecordsSize = event.Records.length


  if (event.Records.length > 1 && event.Records.length != 0) {
    let ArrayOfEvenents = []
    //To spiliting the original event Records to single event
    let bigarray = event.Records;
    const sizePerArray = 1;
    for (var i = 0; i < bigarray.length; i += sizePerArray) {
      let handledEvent = {
        Records: []
      };
      handledEvent.Records = bigarray.slice(i, i + sizePerArray);
      ArrayOfEvenents.push(handledEvent);
    }
    // ArrayOfEvenents.forEach(async function (event) { 
    //   new Promise(async (resolve, reject) => { 
    //         let HundleOneEventAtAtimeResult = await HundleOneEventAtAtime(event);
    //         // console.log("HundleOneEventAtAtimeResult>>>",HundleOneEventAtAtimeResult);
    //         resolve(HundleOneEventAtAtimeResult);
    //     }); 
    // });
    if (ArrayOfEvenents.length == bigarray.length) {
      console.log("ArrayOfEvenents>>", JSON.stringify(ArrayOfEvenents));
      await Promise.all(ArrayOfEvenents.map(async (SingleEvent) => {
        // 	await HundleOneEventAtAtime(SingleEvent);
        // 	console.log("SingleEvent>>>",JSON.stringify(SingleEvent));
        let HundleOneEventAtAtimeResult = await HundleOneEventAtAtime(SingleEvent);
        console.log("HundleOneEventAtAtimeResult>>>", HundleOneEventAtAtimeResult);
        // resolve(HundleOneEventAtAtimeResult);                
      }));
    }

  } else {
    try {
      let HundleOneEventAtAtimeResult = await HundleOneEventAtAtime(event);
      console.log("HundleOneEventAtAtimeResult>>>", HundleOneEventAtAtimeResult)
    } catch (e) {
      console.log("Eroor >", e)
      // UpdateStatusToCertDynmoDB(event.Records[0].dynamodb.Keys.CertsId.S,"failed");
    }
  }
};

function HundleOneEventAtAtime(event) {
  return new Promise(async (resolve, reject) => {
    // OldData is the DB content before this event
    // const OldData = event.Records.map(
    //     record => AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage)
    // );

    let NewData = event.Records.map(
      record => AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage)
    );
    globalEventBody = NewData;


    try {
      if (event.Records[0].eventName == "INSERT" && NewData[0].CertStatus == "pending") {
        //here start the Certs generation proccess 
        CertsId = event.Records[0].dynamodb.Keys.CertsId.S;
        BearerAuthToken = globalEventBody[0].AuthInfo.BearerAuthToken;
        ClientHost = globalEventBody[0].AuthInfo.clienthostname;
        CertGeneralInfo = globalEventBody[0].ArrData[0];
        console.log('CertsId>>>:', CertsId);
        console.log('NewData:', NewData);
        console.log('ClientHost>>>:', ClientHost);
        console.log('BearerAuthToken>>:', BearerAuthToken);
        // here start the MainCertGenerate 
        //Payload strucute : 
        //To spiliting the original array to smaller ones
        let bigarray = globalEventBody[0].ArrData;
        const sizePerArray = 1;
        for (var i = 0; i < bigarray.length; i += sizePerArray) {
          let SingleCertData = {
            eventCertTemplateURL: globalEventBody[0].eventCertTemplateURL,
            ArrData: bigarray.slice(i, i + sizePerArray),
            CertsId: globalEventBody[0].CertsId,
            AuthInfo: globalEventBody[0].AuthInfo
          };
          await MainCertGenerate(SingleCertData)
            .then(async function (resMainCertGenerate) {
              console.log("resMainCertGenerate>>>", resMainCertGenerate);
              /* the resMainCertGenerate should have the following
               resMainCertGenerate = {
          PDFCertURL:res,
          CertsId:CertsId,
          service_id:generalinfo.service_id,
          clienthostname: AuthInfo.clienthostname,
          BearerAuthToken: AuthInfo.BearerAuthToken,
          user_id: generalinfo.user_id
        };
              */
              let GeneratedCertInfoObj = {
                user_id: resMainCertGenerate.user_id,
                BearerAuthToken: resMainCertGenerate.BearerAuthToken,
                clienthostname: resMainCertGenerate.clienthostname,
                service_id: resMainCertGenerate.service_id,
                PDFCertURL: resMainCertGenerate.PDFCertURL
              };
              let resultsDBupdate = await AddCertsInfoToCertDynmoDB(resMainCertGenerate.CertsId, GeneratedCertInfoObj);
              resolve(resultsDBupdate);
            });

        }

      } else if (event.Records[0].eventName == "MODIFY" && NewData[0].CertStatus == "generated") {
        console.log('In GeneratedCertInfo Stage >>');
        let GeneratedCertInfo = globalEventBody[0].GeneratedCertInfo;
        console.log('GeneratedCertInfo >>', GeneratedCertInfo);
        // ClientHost = "https://devwebinar6.api-dev.academi.sa";  //generalinfo 
        let DBBearerAuthToken = GeneratedCertInfo.BearerAuthToken;
        let DBClientHost = GeneratedCertInfo.clienthostname;
        /*
        GeneratedCertInfoObj = {
                     user_id: generalInfo.user_id,
                     BearerAuthToken: "Token",
                     service_id: generalInfo.service_id,
                     PDFCertURL:uploadResult
                 }
                 
        
        */
        let json_requests = JSON.stringify({ json_requests: `[{"user_id":${GeneratedCertInfo.user_id},"service_id":${GeneratedCertInfo.service_id},"pdf":"${GeneratedCertInfo.PDFCertURL}"}]` });
        // you can email it to a user 
        // you can update the Client's DB
        let SaveToDBstatus = saveToDB(json_requests, DBClientHost, DBBearerAuthToken);
        console.log("SaveToDBstatus>>>", SaveToDBstatus)
        resolve(SaveToDBstatus);
      } else {
        resolve("Nothing To DO!")
      }
    } catch (e) {
      console.log("Eroor >", e);
      reject("Eroor >", e);
      // UpdateStatusToCertDynmoDB(event.Records[0].dynamodb.Keys.CertsId.S,"failed");
    }
  });

}

function UpdateStatusToCertDynmoDB(CertsId, CertStatus) {
  console.log('in TestUpdate >> ');
  var params = {
    TableName: TABLE_NAME,
    Key: {
      "CertsId": CertsId
    },
    UpdateExpression: "SET CertStatus = :CertStatus",
    ExpressionAttributeValues: {
      ":CertStatus": CertStatus
    },
    ReturnValues: "UPDATED_NEW"
  };
  return ddb.update(params).promise();
}


/*
 CertInfo is an object that contains :
 -user_id (the owner of cert.)
 -BearerAuthToken Valid for at least 10min: for invoce DB API;
 -service_id (the course/webinar)
 -Cert URL in PDF
*/
function AddCertsInfoToCertDynmoDB(CertsId, CertInfo) {
  console.log('in AddCertsInfoToCertDynmoDB and CertInfo is >> ', CertInfo);
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

// ------ 


/**
 * MainCertGenerate is the function to handle multiple ArrData and send it to DB in background
 * this function will not return error if a single cert. failed.
 * the error will be send to stored in DB
 */
async function MainCertGenerate(SingleCertData) {

  console.log("MainCertGenerate SingleCertData :>>", JSON.stringify(SingleCertData));

  let eventArrData = SingleCertData.ArrData[0];
  let generalinfo = SingleCertData.ArrData[0].generalinfo; // the service & platfrom details 
  let SingleCertTemplateURL = SingleCertData.eventCertTemplateURL;
  let CertsId = SingleCertData.CertsId;
  let AuthInfo = SingleCertData.AuthInfo;
  return new Promise(async function (resolve, reject) {
    //Load a pptx file from URL as binary content
    let filenametemp = `cerTemp-${Math.floor(Math.random() * 99)}-${Date.now()}.pptx`;
    let certfile;
    await download(SingleCertTemplateURL, filenametemp)
      .then(async function (LocalCertFile) {
        console.log("LocalCertFile res", LocalCertFile); //res = file name after downloading
        certfile = fs.readFileSync(LocalCertFile, "binary");
        try {
          let doc;
          let i = 0;
          let cert = eventArrData.certsdata; // the data of user who going to get the cert.
          // generalinfo = eventArrData.generalinfo; // the service & platfrom details
          let zip = new PizZip(certfile);
          doc = new Docxtemplater(zip);
          console.log('now in %s: %s', CertsId, JSON.stringify(cert));
          doc.render(cert);
          let buf = doc.getZip()
            .generate({ type: 'nodebuffer' });
          fs.writeFileSync(`/tmp/output-${CertsId}.pptx`, buf);
          await topdf(`/tmp/output-${CertsId}.pptx`, generalinfo, cert, SingleCertTemplateURL)
            .then(function (res) {
              console.log("topdf res :>>", res);
              /*
                                       user_id: CertGeneralInfo.user_id, 
              */
              let resObj = {
                PDFCertURL: res,
                CertsId: CertsId,
                service_id: generalinfo.service_id,
                clienthostname: AuthInfo.clienthostname,
                BearerAuthToken: AuthInfo.BearerAuthToken,
                user_id: generalinfo.user_id
              };
              console.log("topdf resObj :>>", JSON.stringify(resObj));

              resolve(resObj);
            }).catch(async function (e) {
              let status2failed = await UpdateStatusToCertDynmoDB(CertsId, "failed");
              console.log('status2failed >>:', status2failed);
              console.error("Error3::", e.toString());
              reject(e.toString());
            });

        } catch (err) {
          let status2failed = await UpdateStatusToCertDynmoDB(CertsId, "failed");
          console.log('status2failed >>:', status2failed);
          reject(err);
        }

      }).catch(function (e) {
        console.error("Error1::", e.toString());
        reject(e.toString());
      });
  });
}


/**
 * 
 * To Convert Files based on a specific type 
 * 
 */

async function CloudConvertFiles(File, Type, SingleCertTemplateURL) {

  return new Promise(async function (resolve, reject) {
    if (Type == "pdf") {
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
        let uploadTask = Job.tasks.filter(task => task.name === 'upload-my-file')[0];
        let inputFile = fs.createReadStream(`${File}`);
        await cloudConvert.tasks.upload(uploadTask, inputFile, File);
        return Job;
      }).then(async function (JobAfterUpload) {
        console.log("JobAfterUpload.id >>> ", JobAfterUpload.id);
        let PDFURL = await CloudConvertGetURL(JobAfterUpload.id);
        resolve(PDFURL);
      }).catch(function (e) {
        console.error("Error2::", e.toString());
        reject(e.toString());
      });
    } else {
      await cloudConvert.jobs.create({
        "tasks": {
          "import-file": {
            "operation": "import/url",
            "url": SingleCertTemplateURL,
            "filename": "cerTemp7.pptx"
          },
          "Convert2png": {
            "operation": "convert",
            "input": [
              "import-file"
            ],
            "output_format": "png",
            "engine": "libreoffice",
            "pages": "1"
          },
          "export2url": {
            "operation": "export/url",
            "input": [
              "Convert2png"
            ],
            "inline": true,
            "archive_multiple_files": false
          }
        },
        "tag": "jobbuilder"
      }).then(async function (Job) {
        console.log("Job >> ", JSON.stringify(Job));
        resolve(Job);
      }).catch(function (e) {
        console.error("Error3::", e.toString());
        reject(e.toString());
      });

    }

  });
}


/**
 * 
 * To check the result of conversion from CloudeConvert service
 * 
 */

async function CloudConvertGetURL(JobID) {

  return new Promise(async function (resolve, reject) {
    let TaskURL = new URL(`https://sync.api.cloudconvert.com/v2/jobs/${JobID}`);
    console.log(`previewUrljob.id >>>> ${JobID}`);

    var options = {
      "method": "GET",
      "hostname": TaskURL.hostname,
      "port": null,
      "path": TaskURL.pathname,
      "headers": {
        "authorization": `Bearer ${CLUDCONVERT_API_KEY}`,
        "cache-control": "no-cache",
      }
    };

    try {
      let previewUrl = null;
      let idx = setInterval(function () {
        var req = https.request(options, function (res) {
          var chunks = [];
          res.on("data", function (chunk) {
            chunks.push(chunk);
          });
          res.on("end", function () {
            var body = JSON.parse((Buffer.concat(chunks)).toString());
            let newjob = body.data.tasks.filter(function (el) {
              return el.name == 'export2url';
            });
            if (typeof JobID !== 'undefined' && typeof newjob !== 'undefined' && newjob && previewUrl == null && newjob[0].result != null) {
              previewUrl = newjob[0].result.files[0].url;
              console.log(`previewUrl2 >> ${previewUrl}`);
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

/**
 * Downloads file from remote HTTP[S] host and puts its contents to the
 * specified location.
 */
// function download(TheUrl, fileName) {  
// let URLObj = new URL(TheUrl);
// console.log("URLObj.hostname >>> %s \n URLObj.pathname >>> %s  ",URLObj.hostname , URLObj.pathname);
//  return new Promise(function(resolve, reject) {
//   console.log("Downloading ...");
//       let file = fs.createWriteStream(`/tmp/${fileName}`);
//       let callback = function(res) {
//         // reject on bad status
//         if (res.statusCode < 200 || res.statusCode >= 300) {
//           new Error('statusCode=' + res.statusCode);
//         }
//         // cumulate data
//         res.pipe(file);
//         // resolve on end
//         res.on('end', function() {
//             // nothing?
//         });
//           // after download completed close filestream
//         file.on("finish", () => {
//           file.close();
//           console.log("Download Completed");
//           try {
//             console.log("file.path >>",file.path);
//             resolve(file.path);
//           } catch(e) {
//               new Error('statusCode=' + e);
//               reject('statusCode=' + e);
//           }
//         });
//     };
//     var options = {
//         host : URLObj.hostname,
//         path:  URLObj.pathname,
//         json: true,
//         headers: {
//             "content-type": "application/json",
//             "accept": "application/json"
//         },
//     };

//  var req = https.get(options, callback) ;
//     // IMPORTANT
//  req.end();
//   });
// } 

function download(TheUrl, fileName) {
  //   const file = fs.createWriteStream(fileName);
  //check for tmp dir. 
  //       https.get(url, function(response) {
  //          response.pipe(file);
  //       }); 
  //   return fileName;

  return new Promise((resolve, reject) => {
    let file = fs.createWriteStream(`/tmp/${fileName}`);
    let URLObj = new URL(TheUrl);
    let options = {
      host: URLObj.hostname,
      path: URLObj.pathname,
      json: true,
      headers: {
        "content-type": "application/json",
        "accept": "application/json"
      },
    };
    file.on("finish", () => {
      file.close();
      console.log("Download Completed");
      console.log("file.path >>", file.path);
      //   try {
      //     console.log("file.path >>",file.path);
      resolve(file.path);
      //   } catch(e) {
      //       new Error('statusCode=' + e);
      //       reject('statusCode=' + e);
      //   }
    });
    let req = https.get(options, function (res) {
      res.pipe(file);
      res.once('end', function () {
        console.log("file.path >>", file.path);
        // resolve(file.path);
      });
    });
    req.on('error', (err) => {
      reject(err);
    });
    req.end();
  });
}

/**
 * Convert file to pdf
 * Authorization: for invoce DB API;
   ClientHost: to specifiy the host of the endpoint
 */
function topdf(filename, generalInfo, cert, SingleCertTemplateURL) {
  console.log("filename>>", filename);
  return new Promise(async function (resolve, reject) {
    // await convertapi.convert('pdf', { File:filename })
    await CloudConvertFiles(filename, "pdf", SingleCertTemplateURL)
      .then(async function (result) {
        // get converted file url
        // console.log("ConvertAPI file url: " + result.file.url);
        console.log("Cloud Convert file url: " + result);

        await uploadAttachmentToS3(result, generalInfo, cert)
          .then(async function (uploadResult) {
            // get converted file url
            console.log("myS3Url " + uploadResult);
            // here save to db only if the upload to s3 completed
            if (uploadResult != null && uploadResult != "") {
              resolve(uploadResult);
            } else {
              reject(`Error uploading cert file:-${cert.UserName}`);
            }
          })
          .catch(function (e) {
            console.error("Error: can't save to db,", e.toString());
            return `Error: can't save to db: ${e.toString()}`;
          });
      }) //end of then
      .catch(function (e) {
        console.error(e.toString());
        reject(`Error convert cert file:-${e.toString()}`);
      }); //end of catch
  }); // end of promise
}



async function uploadAttachmentToS3(url, generalInfo, cert) {
  //------ s3 config (not needed on labmda )
  let s3 = new aws.S3();
  s3.config.region = 'us-east-1';
  s3.config.update({
    accessKeyId: ' ',
    secretAccessKey: ''
  });
  //--------- 
  // generalInfo ==> for upload {}
  let type = 'application/pdf';
  console.log("downloadAttachment: " + url);
  console.log("generalInfo>>: " + JSON.stringify(generalInfo)); //"generalinfo":{"user_id":3,"service_id":2,"platform"
  return axios.get(url, {
    responseType: 'arraybuffer'
  })
    .then(response => {
      let buffer = Buffer.from(response.data, 'base64');
      return (async () => {
        // return uploadAttachmentToS3(type, buffer)
        var params = {
          //file name you can get from URL or in any other way, you could then pass it as parameter to the function for example if necessary
          // Key : 'platfrom/serviceID/certs.pdf', 
          Key: `certs-${generalInfo.platform}/${generalInfo.service_id}/${generalInfo.user_id}-${cert.UserName}.pdf`,
          Body: buffer,
          Bucket: 'createdcontent',
          ContentType: type,
          ACL: 'public-read' //becomes a public URL
        };
        //notice use of the upload function, not the putObject function
        return s3.upload(params).promise().then((response) => {
          console.log("S3 response.Location", response.Location);
          return response.Location;
        }, (err) => {
          return { type: 'error', err: err };
        });
      })();
    })
    .catch(err => {
      return { type: 'error', err: err };
    });
}



async function saveToDB(json_requests, DBClientHost, DBBearerAuthToken) {
  return new Promise(async function (resolve, reject) {
    console.log("(json_requests>> %s,DBClientHost>> %s,DBBearerAuthToken>> %s)", json_requests, DBClientHost, DBBearerAuthToken);
    let headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": DBBearerAuthToken
    };
    await axios.post(`${DBClientHost}/api/v0.9.2/MC-1848/add-certificates`, json_requests, { headers: headers })
      .then((response) => {
        console.log("Save to Database status::", JSON.stringify(response.status));
        resolve("Save to Database status::", response);
      })
      .catch(err => {
        console.log("Save to Database error::", err);
        reject({ type: 'error', err: err });
      });

  });
}