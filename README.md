# Generate PDF files based on DB events
This code will allow you yo generate PDF files from a template

# Tech Stack information
- AWS Dynamodb streams
- AWS Lambda
- Nodejs

## Features
- can handle multiple events at the same time simultaneously
- update local DB through an API call
- upload files to S3

## Flow diagram
1- Data Inserted/modified in Dynamodb (streams enabled).
2- AWS Dynamodb will trigger an AWS Lambda.


## Prerequisite
you should prepare the following keys, and replace it in the code before start
- [S3] - accessKeyId
- [S3] - secretAccessKey
- [CLUDCONVERT] - CLUDCONVERT_API_KEY


## required packages
packages.json
- axios // to invoke external API endpoint.
- docxtemplater //  to read  and control docs
- pizzip  // to read  and control docs
- aws-sdk // for uploading to s3
- fs  // for reading files
- https // for downloading files from external URL
- cloudconvert // for converting files to pdf

## Installation
Install the dependencies and devDependencies.

```sh
npm i
node index.js
```
 

## Function Mechanism & Pseudocode

A dynamodb streams will trigger this function, the stream will have single recored or multiple recoreds, and based on that the function will preforme it's actions

1- Recive dynamoDB event
2- If the event has multiple recorded run each one of them simultaneously starting from point 4.
3- Else go to 4.
4- Check if (eventName == "INSERT" && CertStatus == "pending") go to 6.
5- Else if (eventName == "MODIFY" &&  CertStatus == "generated") go to 13.
6- get data to generate new file.
7- download the Template file
8- start replacing data from step 6 to a new file using template in step 7
9- save output of step 8 to {/tmp}.
10 -start converting the file from step 9 to pdf format.
11- upload the output file from step 10 to AWS S3.
12- Insert Info To DynmoDB with CertStatus == "generated".
13- Send API request and save info to local DB.
 

## Expected [responses] & [requests] to be used in this function:

aws dynamodb streams event:

> Note: 
`eventName` is the event type, and it's comming from dynmoDB, the possible status are [INSERT-MODIFY-REMOVE]
`CertsId` is an unique id.
`AuthInfo` is an object the contains required information to invoke API endpoint.
`CertStatus` is a flag to indecate the file generating stage (you can change it).
`eventCertTemplateURL` is a URL for the template file that should be used to generate new files.
`ArrData.certsdata` is user information that should be used to generate the new file for this user based on the template file.
`ArrData.generalinfo` is general info for system logs info only.

 

#### Upload to S3 instructions :

here is some required customaztion you should follow

```sh
Key: `certs-${generalInfo.platform}/${generalInfo.service_id}/${generalInfo.user_id}-${cert.UserName}.pdf`
```

#### invoke API endpoint example:

this code is using axios

```sh
    let headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": ${AuthInfo.BearerAuthToken}
    };
    await axios.post(`${AuthInfo.clienthostname}/api/v0.9.2/MC-1848/add-certificates`, json_requests, { headers: headers})
```

