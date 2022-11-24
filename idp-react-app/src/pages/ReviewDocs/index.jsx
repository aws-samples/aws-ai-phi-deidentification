/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import React, { useState } from 'react';
import {   
  Panel,
  Placeholder,
  Tag,
  DatePicker,  
  Message,
  Container, 
  Header, 
  Loader,
  Table } from 'rsuite';  
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom';
import CheckIcon from '@rsuite/icons/Check';
import TimeIcon from '@rsuite/icons/Time';
import RemindOutlineIcon from '@rsuite/icons/RemindOutline';
import { useWorkflows } from 'src/hooks/useWorkflows';
import isAfter from 'date-fns/isAfter';
import getTime from 'date-fns/getTime';
import startOfDay from 'date-fns/startOfDay';
import endOfDay from 'date-fns/endOfDay';
import './styles.less';

const { Column, HeaderCell, Cell } = Table;
const CompactHeaderCell = props => {      
      const headerStyle = { padding: (props.children === "Workflow ID")?18:4, 
                            color: '#757575', 
                            background: "#FAFAFA", 
                            fontSize: '14px', 
                            fontWeight: 'bold' 
                          }
      return <HeaderCell 
                  {...props} 
                  style={headerStyle} 
              />
};

const defaultColumns = [
  {
    key: 'part_key',
    label: 'Workflow ID',
    fixed: true,    
    minwidth: 300,
    flexGrow: 3,
    verticalAlign: 'middle'
  },
  {
    key: 'total_files',
    label: 'Number of Docs',
    width: 200,
    verticalAlign: 'middle'
  },
  {
    key: 'status',
    label: 'OCR Status',
    minwidth: 500,
    flexGrow: 1,
    verticalAlign: 'middle'
  },
  {
    key: 'de_identification_status',
    label: 'De-dientification Status',
    minwidth: 550,
    flexGrow: 1,
    verticalAlign: 'middle'
  },
  // {
  //   key: 'de_identify',
  //   label: undefined,
  //   minwidth: 0
  // },
  {
    key: 'submit_ts',
    label: 'Time Submitted',
    width: 200,
    verticalAlign: 'middle'
  } 
];

const getStatus = (status) => {
    switch (status) {
      case "processing":
        return <Tag color="blue">                
                <Loader size='xs' content={status} style={{marginTop: '4px'}} inverse/>                
              </Tag>          
      case "complete":
        return <Tag color="green">                
                  <CheckIcon style={{marginRight: '4px'}}/>             
                  {status}            
                </Tag>
      default:
        return <Tag>                
                  <RemindOutlineIcon style={{marginRight: '4px'}}/>             
                  {status}
                </Tag>
    }
}

const getDeidStatus = (status) => {
  switch (status) {
    case "processing":
      return <Tag color="blue">                
                <Loader size='xs' content={status} style={{marginTop: '4px'}} inverse/>                
              </Tag>        
    case "processed":
      return <Tag color="green">                
                <CheckIcon style={{marginRight: '4px'}}/>             
                complete
              </Tag>
    case "queued":
      return <Tag color="yellow">                
                <TimeIcon style={{marginRight: '4px'}}/>             
                queued
              </Tag>
    case "not_requested":
      return <Tag>                
                NOT REQUESTED              
              </Tag>
    default:
      return <Tag>                
                <RemindOutlineIcon style={{marginRight: '4px'}}/>             
                {status}                
              </Tag>
  }
}

const ReviewDocs = () => {
    const [columnKeys] = React.useState(defaultColumns.map(column => column.key));
    const columns = defaultColumns.filter(column => columnKeys.some(key => key === column.key));
    const [startDt, setstartDt] = useState(getTime(startOfDay(new Date())));
    const [endDt, setendDt] = useState(getTime(endOfDay(new Date())));
    const { data, isError, isFetching } = useWorkflows("workflow-list-global", "all", {startDt, endDt});
    const navigate = useNavigate();
    
    const setDateRange = (dt) => {
      const dtStr = format(dt, 'MM/dd/yyyy');      
      const start = getTime(startOfDay(new Date(dtStr)));
      const end = getTime(endOfDay(new Date(dtStr)))
      setstartDt(start)
      setendDt(end);
    }

    const CompactCell = (props) => {  
      const cellStyle = {padding: 4, cursor: (props.rowData.status === "complete")?'pointer':undefined}
      if(props.dataKey === "status"){
        return <Cell {...props} style={{...cellStyle,  fontWeight: 'bold'}}>
                    {getStatus(props.rowData.status)}
                </Cell>      
      }else if(props.dataKey === "submit_ts"){
        return <Cell {...props} style={cellStyle}>
                    {format(props.rowData.submit_ts, 'MM/dd/yyyy p')}
                </Cell>   
      }else if(props.dataKey === "part_key"){
        return <Cell {...props} style={{...cellStyle, paddingLeft: '18px'}}>
                    {props.rowData.part_key}
                </Cell>   
      }else if(props.dataKey === "de_identification_status"){                  
          return <Cell {...props} style={{...cellStyle,  fontWeight: 'bold'}}>
                {
                  (props.rowData.status === "processing")?
                  getDeidStatus("queued")
                  :getDeidStatus(props.rowData.de_identification_status)
                }                    
                </Cell>             
      }
      else{
        return <Cell {...props} style={cellStyle} />;
      }  
    }

    const navigateToDetail = (status, part_key) =>{
      if (status === "complete"){
        navigate(`/review/wf/${part_key}`)
      }      
    }

    return (
      <Container>
        <Header className='rd-header'>
          <div>
            <h3>Review Analysis Jobs</h3>
            <span><b>Review documents and outputs in your bulk OCR and de-dentification workflow</b></span>
          </div>
        </Header>
        {
          (isError)&&
          <Message showIcon type="error">
                <b>Error:</b> Something went wrong while trying to process this request. Please refresh or try again. If the problem persists,
                please check your internet connection and log back in.
          </Message>
        }        
        <Panel bordered bodyFill className='rd-content'
                header={<DatePicker 
                              format='MM/dd/yyyy' 
                              size='sm' 
                              oneTap={true}
                              defaultValue={new Date()} style={{ width: 200 }} 
                              cleanable={false}
                              onChange={setDateRange}
                              disabledDate={date => isAfter(date, new Date())}/>
                        }>
            {
              (data)?
              <Table
                loading={isFetching}
                height={500}
                hover={true}
                showHeader={true}
                autoHeight={false}
                data={data? data['workflows']: []}
                cellBordered={false}
                headerHeight={60}
                rowHeight={40}
                onRowClick={(obj) => navigateToDetail(obj.status, obj.part_key)}                
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
              :<Placeholder.Grid rows={10} columns={4} active style={{padding: 14}}/>
            }
        </Panel>
      </Container>
    )
}

export default ReviewDocs;