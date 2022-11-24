/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import React, {useState, useEffect} from 'react';
import { Grid, Row, Col, Table, Toggle, Stack, Panel, IconButton } from 'rsuite';
import FileDownloadIcon from '@rsuite/icons/FileDownload';

const { Column, HeaderCell, Cell } = Table;
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
      key: 'entity',
      label: 'Entity',    
      flexGrow: 3,
      verticalAlign: 'middle'
    },
    {
      key: 'entity_type',
      label: 'Entity Type',    
      flexGrow: 1,
      verticalAlign: 'middle'    
    },
    {
      key: 'score',
      label: 'Confidence',      
      flexGrow: 1,
      verticalAlign: 'middle'
    }
  ];

const PhiDisplay = ({docUrl, phiData, mimeType, docName}) => {
    const [columnKeys] = useState(defaultColumns.map(column => column.key));
    const columns = defaultColumns.filter(column => columnKeys.some(key => key === column.key));
    const [data, setdata] = useState(undefined)  
    const [docURL, setdocURL] = useState(undefined)  
    const [maskData, setmaskData] = useState(true);
    
    useEffect(() => {
      const entities = phiData["Entities"];
      const dataset = [];
      for(const entity of entities){
        let ent = {};
        ent["entity"] = entity["Text"];
        ent["entity_type"] = entity["Type"];
        ent["score"] = parseInt(entity["Score"].toPrecision(2) * 100,10)+"%";
        dataset.push(ent)
      }
      setdata(dataset);
      setdocURL(docUrl);
    }, [phiData, docUrl])

    const CompactCell = props => {
        if(props.dataKey === 'entity'){
            return <Cell {...props} style={{ padding: 4 }}>
                    {
                        (maskData)?
                        "X".repeat(props.rowData.entity.length)
                        :<b>{props.rowData.entity}</b>
                    }                    
                </Cell>;
        }
        if(props.dataKey === 'entity_type'){
            return <Cell {...props} style={{ padding: 4 }}>
                        <code>{props.rowData.entity_type}</code>
                </Cell>;
        }
        if(props.dataKey === 'score'){
            return <Cell {...props} style={{ padding: 4 }}>                
                        <code>{props.rowData.score}</code>
                </Cell>;
        }
        return <Cell {...props} style={{ fontSize: '12px', padding: 4 }} />;
    } 
    
    return (
        <div>    
            <Panel bordered bodyFill style={{padding: 8, marginBottom: 12, background: 'white'}}>
                Displaying document: <b>{docName}</b>
            </Panel>    
            <Grid fluid>
                <Row gutter={22}>
                    <Col xxl={12} xl={12} lg={24} xs={24} sm={24} md={8} >                        
                        <div style={{height: '100vh', overflow: 'hidden', background: 'white', padding: (mimeType === 'application/pdf')?undefined:'20px'}} className="rs-panel rs-panel-bordered">    
                            {
                                (mimeType === "image/tiff")?
                                <Stack direction='column' spacing={12}>
                                    TIF file cannot be viewed in the browser. Please download to view.
                                    <IconButton href={docURL} appearance="primary" icon={<FileDownloadIcon/>}>Download file</IconButton>
                                </Stack>
                                :<embed src={`${docURL}#view=fitH`} type={mimeType} style={{height: (mimeType === 'application/pdf')?'100%':undefined, width: '100%'}}/>
                            }                                                    
                        </div>
                    </Col>
                    <Col xxl={12} xl={12} lg={24} xs={24} sm={24} md={8} style={{height: '100vh',overflowY: 'scroll'}}>
                        <Panel style={{background: 'white'}} bordered>
                        {
                            (data)&&                            
                                <div>
                                    <div style={{margin: '16px 0px 8px 0px'}}>
                                        <h4>Protected Health Information (PHI) de-identification standard</h4>
                                        <p>                                        
                                        Section 164.514(a) of the HIPAA Privacy Rule provides the standard for de-identification of protected health information.  Under this standard, health information is not individually identifiable if it does not identify an individual and if the covered entity has no reasonable basis to believe it can be used to identify an individual.
                                        </p>
                                    </div>
                                    <Stack style={{margin: '12px 4px 12px 0px'}} spacing={8}>
                                        <Toggle checked={maskData} onChange={setmaskData}/>
                                        <span>
                                            {
                                                (maskData)? "Un-mask PHI":"Mask PHI"
                                            }
                                        </span>
                                    </Stack>
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
                                        wordWrap="break-word"
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
                                </div>
                        }
                        </Panel>
                    </Col>        
                </Row>
            </Grid>
        </div> 
    )
}

export default PhiDisplay