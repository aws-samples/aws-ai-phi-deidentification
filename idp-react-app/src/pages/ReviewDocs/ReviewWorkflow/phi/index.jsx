/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import React, {useState} from 'react';
import { useParams } from 'react-router-dom';
import PhiDisplay from './PhiDisplay';
import { useWorkflows } from 'src/hooks/useWorkflows';
import StorageService from 'src/services/storage_services';
import { Table, Stack, Panel, Placeholder, Divider, Message, Loader } from 'rsuite';
import RemindOutlineIcon from '@rsuite/icons/RemindOutline';

const { Column, HeaderCell, Cell } = Table;
const CompactHeaderCell = props => <HeaderCell 
                                      {...props} 
                                      style={{ 
                                          paddingLeft: 16, 
                                          color: '#757575', 
                                          background: "#FAFAFA", 
                                          fontSize: '13px', 
                                          fontWeight: 'bold'
                                        }} 
                                      />;

const defaultColumns = [
  {
    key: 'document',
    label: 'Redacted Documents',
  //   width: 180,       
    flexGrow: 2,
    verticalAlign: 'middle'
  }
];

const PhiTab = () => {
    const [columnKeys] = useState(defaultColumns.map(column => column.key));
    const columns = defaultColumns.filter(column => columnKeys.some(key => key === column.key));
    const {wfid} = useParams();
    const { data, isError, isFetching } = useWorkflows("workflow-list-exact", wfid);
    const storage = new StorageService(); 

    const [docUrl, setdocUrl] = useState(undefined);
    const [phiData, setphiData] = useState(undefined);
    const [docMime, setdocMime] = useState(undefined)
    const [phiLoading, setphiLoading] = useState(false);
    const [selectedDoc, setselectedDoc] = useState(undefined);

    const CompactCell = props =>{
        const weight = (props.rowData.document === selectedDoc)? 'bold': undefined
        const bgColor = (props.rowData.document === selectedDoc)? '#E1F5FE':undefined;
        return <Cell {...props} style={{ paddingLeft: 16, cursor: 'pointer', fontWeight: weight, backgroundColor: bgColor}}>
                  {props.rowData.document}
                </Cell>;      
    }

    if(!data['phi_data']['de_identify']){
      return <Panel bordered bodyFill>
              <Message showIcon type="info" header={<b>Not available</b>}>
                    De-identification is disabled for the documents in this analysis job
                  </Message>
              </Panel>
    }

    if(data['phi_data']['de_identify'] && data['phi_data']['de_identification_status'] === 'processing'){
      return <Panel bordered style={{background: 'white', marginBottom: '10px', textAlign: 'center'}}>              
                <Loader size='md' content={<b style={{fontSize: '16x'}}>De-dentification in progress</b>} vertical/>              
              </Panel>
    }

    if(data['phi_data']['de_identify'] && data['phi_data']['de_identification_status'] === 'failed'){
      return <Panel bordered style={{background: 'white', marginBottom: '10px', textAlign: 'center'}}>              
                <Stack direction='column'>
                  <RemindOutlineIcon style={{ fontSize: '1.2em', color: 'red' }}/>
                  <h4>Failed to perform PHI de-identification</h4>
                </Stack>
              </Panel>
    }

    const getPhiData = async(doc_url, phi_data_url, documentName) =>{
      let documentUrl, responseJson, documentMime;
      setphiLoading(true);
      setselectedDoc(documentName);
      try {                                      
          const docurl = await storage.genSignedURL(doc_url, false);
          const phiurl = await storage.genSignedURL(phi_data_url);

          documentUrl = docurl?.url || undefined;
          documentMime = docurl?.contentType || undefined;
          const phi_url = phiurl?.url || undefined;
          setdocUrl(documentUrl);
          setdocMime(documentMime);          

          let response = await fetch(phi_url);
          responseJson = await response.json();
          setphiData(responseJson);
          setphiLoading(false);
      } catch (error) {        
          setphiLoading(false);
          throw error;          
      }
    }

    return (
      <div>
        <Panel header={<b>Summary</b>} bordered style={{background: 'white', marginBottom: '10px'}}>
            <Stack wrap spacing={30} style={{fontSize: '18px'}} divider={<Divider vertical/>}>
              {/* <div>Status: <b>{data['phi_data']['status']}</b> </div> */}
              <div>Total files: <b>{data['phi_data']['totalFiles']}</b> </div>
              <div>Files processed: <b>{data['phi_data']['successfulFilesCount']}</b> </div>
              <div>Files Un-processed: <b>{data['phi_data']['failedFilesCount']}</b> </div>
              <div>Original document retention: <b>{(data['phi_data']['retain_orig_docs'])? "True":"False"}</b></div>
            </Stack>
        </Panel>
        <Panel style={{background: 'white', marginBottom: '10px'}} bordered bodyFill>
          {
            (data)?
            <Table                             
                  hover={true}
                  showHeader={true}              
                  autoHeight={true}
                  affixHeader
                  data={data? data['phi_data']['documents']:[]}
                  cellBordered={false}
                  headerHeight={40}
                  rowHeight={40}
                  style={{marginBottom: '24px'}}
                  onRowClick={(obj) => getPhiData(obj['doc_path'], obj['phi_json'], obj['document'])}
              >
              {columns.map(column => {
                  const { key, label, ...rest } = column;
                  return (
                  <Column {...rest} key={`${key}`}>
                      <CompactHeaderCell>{label}</CompactHeaderCell>
                      <CompactCell dataKey={key} />
                  </Column>
                  );
              })}
            </Table>
            :<Placeholder.Grid rows={10} columns={1} active />
          }
        </Panel>
        {
          (docUrl && phiData && !phiLoading)?
          <PhiDisplay docUrl={docUrl} phiData={phiData} mimeType={docMime} docName={selectedDoc}/>
          :(phiLoading)?
          <div style={{textAlign: 'center', marginTop: 12}}>
            <Loader size='md' content="Loading..." vertical></Loader>
          </div>
          :<></>
        }        
      </div>
    )
}

export default PhiTab