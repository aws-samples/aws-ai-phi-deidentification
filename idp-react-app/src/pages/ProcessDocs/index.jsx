/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import React, { useState, useEffect } from 'react';
import {     
  DOMHelper,
  Message,
  Whisper,
  Input,
  Container, 
  Header, 
  Content, 
  Uploader, 
  IconButton, 
  Notification, 
  useToaster,
  Progress,
  Checkbox } from 'rsuite';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import StorageService from 'src/services/storage_services';
import FileUploadIcon from '@rsuite/icons/FileUpload';
import HelpOutlineIcon from '@rsuite/icons/HelpOutline';
import CheckIcon from '@rsuite/icons/Check';
import { ClassifierTooltip, ErTooltip} from 'src/components/Tooltips';
import getTime from 'date-fns/getTime';
import './styles.less';

/**
 * 
 * @param {{endToend: Boolean}} props
 * 
 * endToEnd: Enable disable IDP End-to-end workflow. Boolean defaults `false`
 * 
 * @returns 
 * 
 * React.node()
 */
const { scrollTop } = DOMHelper;

const ProcessDocs = ({ endToend=false }) => {
  const [filesToUpload, setfilesToUpload] = useState([]);
  const [manifestFile, setmanifestFile] = useState([])
  const [isUploading, setisUploading] = useState(false);
  const [uploadedTotal, setuploadedTotal] = useState(1);
  const [completionPct, setcompletionPct] = useState(0);
  const [activeUploadingFile, setactiveUploadingFile] = useState("");
  const [deIdentify, setdeIdentify] = useState(false)
  const [retain, setretain] = useState(false)
  const toaster = useToaster();
  const storage = new StorageService(); 

  const checkUncheck = (val, checked, event) => setdeIdentify(checked);
  const setUnsetRetain = (val, checked, event) => setretain(checked);

  useEffect(() => {
    if(filesToUpload.length > 0){
      const totalPct = (uploadedTotal/filesToUpload.length)*100;         
      setcompletionPct(totalPct.toFixed(0));
    }
  // eslint-disable-next-line
  }, [uploadedTotal])
  

  const fileWarning = (
    <Notification type="warning" header={'File Limit'} closable duration={8000}>
      A maxiumim of 100 files are allowed to be uploaded at a time.
    </Notification>
  );

  const fileUploaded = (
    <Notification type="success" header={'Complete'} closable duration={8000}>
      Documents have been uploaded successfully!
    </Notification>
  );

  const fileUploadFail = (
    <Notification type="error" header={'Error'} closable duration={8000}>
      File upload failed. Please check your network connection and try again!
    </Notification>
  );

  const onFilesAdded = (files) => {  
      //filter since dragged files may be unsupported file types      
      const filteredFiles = files.filter((elem) => ['jpg','png','jpeg','pdf','tif','tiff'].includes(elem.blobFile.name.split('.').pop()))
      setfilesToUpload([...filteredFiles]);
  }

  const onManifestAdded = (files) => {
    const file = files[0];

    if(file){
      const fileReader = new FileReader();
      fileReader.readAsText(file.blobFile, "UTF-8");
      fileReader.onload = e => {
        console.log(JSON.parse(e.target.result));      
      };
      // console.log(file.blobFile);
    }
    
    setmanifestFile([...files]);
  }

  const validateFileCount = (files, file) =>{        
    if(files.length > 200){
      toaster.push(fileWarning, {placement: 'topCenter'});   
      return false;         
    }
    return true;
  }

  const genWorkflow = (prefix) =>{
    const workflow = [];
    workflow.push({'S': prefix});
    workflow.push({'S': `input/${prefix}/`});
    workflow.push({'S': 'processing'});
    const docs = {};
    for(const file of filesToUpload){
      docs[file.blobFile.name] = {'S':'ready'}
    }
    workflow.push({'M': docs})
    workflow.push({'N': `${getTime(new Date())}`});
    workflow.push({'N': `${filesToUpload.length}`});
    workflow.push({'BOOL': deIdentify});
    workflow.push({'BOOL': retain});
    workflow.push({'S': (deIdentify)?'processing':'not_requested'})
    return workflow;
  }

  const uploadFiles = async() => {    
    scrollTop(window, 1500);
    const setUploadProgress = (progress) => {      
      setactiveUploadingFile(progress.filename);      
    }
    setisUploading(true);    
    try {
      const prefix = uuidv4();
      let total = 1;
      for(const file of filesToUpload){                                            
          await storage.upload(file.blobFile, `input/${prefix}/`, setUploadProgress); 
          total = total + 1;
          setuploadedTotal(total);                           
      }      
      const wf = genWorkflow(prefix);
      await storage.writeFile(JSON.stringify(wf),`workflows/${prefix}.json`);
      setdeIdentify(false);
      setretain(false);
      toaster.push(fileUploaded, {placement: 'topEnd'});  
    } catch (error) {      
        setisUploading(false);
        toaster.push(fileUploadFail, {placement: 'topEnd'});  
    }

    //update states
    setisUploading(false);
    setcompletionPct(0.1);
    setuploadedTotal(1);
    setfilesToUpload([]);
    setactiveUploadingFile("");
  }

  return (
    <Container>
      <Header className='pd-header'>
        <div>
          <h3>Process Documents</h3>
          <span><b>Upload documents to process. Documents uploaded together will be processed in a single batch.</b></span>
        </div>
      </Header>
      <Message showIcon type="info" header={<b>NOTE:</b>}>
          You can upload a maximum of 200 documents using this application. This limit is only imposed by this implementation 
          of the demo, however, virtually unlimited documents can be processed using this architecture. For Amazon Textract related
          limits, please refer to the <a href="https://docs.aws.amazon.com/textract/latest/dg/limits.html" rel="noreferrer" target="_blank">Amazon Textract Hard limits</a>. 
          For Amazon Comprehend Medical related limits, please refer to <a href="https://docs.aws.amazon.com/comprehend-medical/latest/dev/comprehendmedical-quotas.html" rel="noreferrer" target="_blank">Amazon Comprehend Medical guidelines and quotas</a>.
      </Message>
      <Content className='pd-content'>
        <h4>Bulk OCR</h4>
        <span style={{fontSize: '12px', color:'gray', marginBottom: '12px'}}>
          Extract WORDS, LINES, FORMS (key-values), and TABLES using Amazon Textract
        </span>
        {
          (isUploading)&&
          <div style={{width: '100%', marginTop: '10px'}}>            
            <Message showIcon type="warning"><b> Upload in progress!</b> Please do not close or refresh this page. Uploading file {activeUploadingFile} ...</Message>
            <Progress.Line percent={completionPct} status={(completionPct<100)?"active":"success"} />
          </div>          
        }
        <Uploader 
          fileList={filesToUpload}
          autoUpload={false} 
          action="/"
          disabledFileItem={isUploading}
          disableMultipart={true}          
          draggable 
          onChange={onFilesAdded}
          shouldQueueUpdate={validateFileCount}
          multiple={true}
          accept=".png,.jpeg,.jpg,.pdf,.tiff,.tif">
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>                        
            <span><FileUploadIcon style={{ fontSize: '4em', marginBlock: '8px', color:"#3498FF" }}/> <br/> Click or Drag files to this area <br/> (.pdf, .png, .jpg, .jpeg, and .tiff files supported) </span>
          </div>
        </Uploader>
        {
          (endToend)&&
          <div>
            <div style={{width: '100%', margin: '20px 0px 20px 0px'}}>
              <label>
                <b>Amazon Comprehend classifier ARN: <i>(optional)</i></b>
                <Whisper placement="right" controlId="control-id-class" trigger="click" speaker={ClassifierTooltip}>
                  <IconButton appearance='link' icon={<HelpOutlineIcon />} circle size="xs" />
                </Whisper>
              </label>
              <Input placeholder='arn:aws:comprehend::1234567890:document-classifier/myClassifier/version/1' />
            </div>
            <div style={{width: '100%', margin: '20px 0px 20px 0px'}}>
              <label>
                <b>Amazon Comprehend entity recognizer ARN: <i>(optional)</i></b>
                <Whisper placement="right" controlId="control-id-er" trigger="click" speaker={ErTooltip}>
                  <IconButton appearance='link' icon={<HelpOutlineIcon />} circle size="xs" />
                </Whisper>
              </label>
              <Input placeholder='arn:aws:comprehend::1234567890:entity-recognizer/myEntityRec/version/1' />
            </div>
            <div>
              <Uploader 
                action="/" 
                fileList={manifestFile}
                autoUpload={false}
                disableMultipart={true} 
                onChange={onManifestAdded}
                accept=".json" 
                style={{marginBottom: '2px !important'}}>
                <span>Upload manifest file <i>(optional)</i></span>
              </Uploader>
              <span style={{fontSize: '11px'}}>If manifest file is not provided then only WORD, LINE, FORM, and TABLE will be extracted from all documents. <Link to="/" target="_blank" rel="noopener noreferrer">Learn more.</Link></span>
            </div>
          </div>
        }       
      </Content>
      <Content className='pd-content'>
        <h4>De-identification</h4>
        <span style={{fontSize: '12px', color:'gray', marginBottom: '12px'}}>
          Identify PHI information in the documents using Amazon Comprehend Medical and perform redaction to de-identify.
        </span>
        <div>
          <Checkbox checked={deIdentify} onChange={checkUncheck} style={{marginTop:'8px', marginBottom: '8px'}}> 
            De-dientify documents <br/>
            <span style={{fontSize: '12px', color:'gray'}}>When checked, any PHI detected in the documents will be redacted.</span>
          </Checkbox>

          {
            (deIdentify)&&
            <div>
              <Checkbox checked={retain} onChange={setUnsetRetain} style={{marginTop:'8px', marginBottom: '8px'}}> 
                Retain original documents <br/>
                <span style={{fontSize: '12px', color:'gray'}}>When checked, original copies of the documents will be retained else deleted.</span>
              </Checkbox>
            </div>
          }
        </div>
        <IconButton           
          appearance='primary'
          loading={isUploading}
          icon={<CheckIcon />} 
          disabled={(filesToUpload.length <= 0 || filesToUpload.length > 200)}
          style={{marginTop: '10px', float: 'right'}}
          onClick={uploadFiles}>
          Submit for processing
        </IconButton> 
      </Content>
    </Container>
  )
}

export default ProcessDocs;