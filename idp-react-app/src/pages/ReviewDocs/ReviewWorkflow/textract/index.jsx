/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import React from 'react';
import { useParams } from 'react-router-dom';
import {   
    Panel,
    Placeholder,
    Tag,
    Message,
    Table } from 'rsuite'; 
import { useWorkflows } from 'src/hooks/useWorkflows';
import DownloadButtons from './DownloadButtons';
import ReloadIcon from '@rsuite/icons/Reload';
import CheckIcon from '@rsuite/icons/Check';
import BlockIcon from '@rsuite/icons/Block';
import RemindOutlineIcon from '@rsuite/icons/RemindOutline';
import "./styles.less";

const defaultColumns = [
    {
      key: 'document',
      label: 'Document',
      width: 200,       
      flexGrow: 3,
      verticalAlign: 'middle',
      fixed: true
    },
    {
      key: 'status',
      label: 'Status',
      width: 150,
      // flexGrow: 1,
      verticalAlign: 'middle'    
    },
    {
      key: 'jobid',
      label: 'Amazon Textract Async Job ID',
      width: 300,
      flexGrow: 3,
      verticalAlign: 'middle'
    },
    {
      key: 'download',
      label: 'Download Data',      
      width: 300,
      // flexGrow: 2,
      verticalAlign: 'middle'
    }
  ];

const { Column, HeaderCell, Cell } = Table;
const CompactHeaderCell = props => <HeaderCell 
                                      {...props} 
                                      style={{ 
                                          padding: 16, 
                                          color: '#757575', 
                                          background: "#FAFAFA", 
                                          fontSize: '14px', 
                                          fontWeight: 'bold'
                                        }} 
                                      />;
const getStatus = (status) => {
    switch (status) {
      case "processing":
        return <Tag color="blue">
                  <ReloadIcon spin style={{marginRight: '4px'}}/>
                  {status}
                </Tag>        
      case "succeeded":
        return <Tag color="green">   
                  <CheckIcon style={{marginRight: '4px'}}/>             
                  processed
                </Tag>
      case 'failed':
      case 'partial_success':
        return <Tag color="green">   
                  <BlockIcon style={{marginRight: '4px'}}/>             
                  {status}
                </Tag>
      default:
        return <Tag>   
                  <RemindOutlineIcon style={{marginRight: '4px'}}/>             
                  {status}
                </Tag>
    }
}

const Textract = () => {
    const [columnKeys] = React.useState(defaultColumns.map(column => column.key));
    const columns = defaultColumns.filter(column => columnKeys.some(key => key === column.key));
    const {wfid} = useParams();
    const { data, isError, isFetching } = useWorkflows("workflow-list-exact", wfid);

    const CompactCell = (props) => {  
        if(props.dataKey === "status"){
            return <Cell {...props} style={{ padding: 4 }}>
                        {getStatus(props.rowData.status)}
                    </Cell>      
        }else if(props.dataKey === "download"){          
            return <Cell {...props} style={{ padding: 4 }}>    
                      <DownloadButtons wfId={wfid} jobId={props.rowData.jobid} document={props.rowData.document}/>
                  </Cell>      
        }else{
          return <Cell {...props} style={{ padding: (props.dataKey === "document")?16:4 }} />;
        }  
      }

    return (
        <Panel style={{background: 'white'}} bordered bodyFill>
                <div style={{height: (!data && isFetching)? 'auto':'600px'}}>
                    {
                    (isError)&&
                    <Message showIcon type="error">
                            <b>Error:</b> Something went wrong while trying to process this request. Please refresh or try again. If the problem persists,
                            please check your internet connection and log back in.
                    </Message>
                    }  
                  {
                    (data)?
                      <Table
                          loading={isFetching}
                          height={600}
                          hover={true}
                          showHeader={true}              
                          autoHeight={false}
                          data={data? data['ocr_data']:[]}
                          cellBordered={false}
                          headerHeight={60}
                          rowHeight={50}
                          wordWrap="break-all"
                      >
                      {columns.map(column => {
                          const { key, label, ...rest } = column;
                          return (
                          <Column {...rest} key={key}>
                              <CompactHeaderCell>{label}</CompactHeaderCell>
                              <CompactCell dataKey={key} />
                          </Column>
                          );
                      })}
                      </Table>
                    :<Placeholder.Grid rows={20} columns={4} active style={{padding: 14}}/>
                  }
                    
                </div>
        </Panel>   
    )
}

export default Textract;