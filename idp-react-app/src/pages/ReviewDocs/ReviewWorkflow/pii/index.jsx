/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import React,  {useState} from 'react';
import PiiDisplay from './PiiDisplay';
import { Grid, Row, Col, Table, Tag, Stack } from 'rsuite';
import ReloadIcon from '@rsuite/icons/Reload';
import CheckIcon from '@rsuite/icons/Check';
import BlockIcon from '@rsuite/icons/Block';
import RemindOutlineIcon from '@rsuite/icons/RemindOutline';

const { Column, HeaderCell, Cell } = Table;
const CompactCell = (props) => {  
  if(props.dataKey === "status"){
      return <Cell {...props} style={{ padding: 4 }}>
                  {getStatus(props.rowData.status)}
              </Cell>      
  }else{
    return <Cell {...props} style={{ padding: 4 }} />;
  }  
}
const CompactHeaderCell = props => <HeaderCell 
                                      {...props} 
                                      style={{ 
                                        //   padding: 4, 
                                          color: '#757575', 
                                          background: "#FAFAFA", 
                                          fontSize: '13px', 
                                          fontWeight: 'bold'
                                        }} 
                                      />;

const defaultColumns = [
  {
    key: 'document',
    label: 'Document',
  //   width: 180,       
    flexGrow: 2,
    verticalAlign: 'middle'
  },
  {
    key: 'status',
    label: 'Status',
  //   width: 180,
    flexGrow: 2,
    verticalAlign: 'middle'    
  },
  {
    key: 'job_id',
    label: 'Entity Detection Job ID',
    flexGrow: 2,
    verticalAlign: 'middle'
  }
];

const data =[
  {
    "document": "discharge-summary.pdf",
    "status": "succeeded",
    "job_id": "a05a043c6361873b72c2917c8336b1c92b4b1499d1bf296cd3192eeea87d9e26"
  },
  {
    "document": "doctors-note.png",
    "status": "succeeded",
    "job_id": "616252ea721fd066197a49349989f551e08752104d42fde57c4dbf3b8eb6ff72"
  }
];

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

const PiiTab = () => {
    const [columnKeys] = useState(defaultColumns.map(column => column.key));
    const columns = defaultColumns.filter(column => columnKeys.some(key => key === column.key));
    return (
      // <Stack direction='column' alignItems='flex-start' spacing={12} style={{width: "100%"}}>
      //   <Stack.Item alignSelf="stretch">
        <div>
          <Table
              // loading={isFetching}
              // width={"100%"}
              // height={900}                                                
              hover={true}
              showHeader={true}              
              autoHeight
              affixHeader
              // affixHorizontalScrollbar
              data={data}
              cellBordered={false}
              headerHeight={40}
              rowHeight={60}                            
              // wordWrap="break-word"
              style={{marginBottom: '24px'}}
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

          <PiiDisplay/>
        </div>
    )
}

export default PiiTab;