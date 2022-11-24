/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import React, {useState, useEffect} from 'react';
import { Grid, Row, Col, Table, Tag, Stack } from 'rsuite';
import compmeddata from 'src/assets/compmed-pii.json';
import groupBy from 'lodash/groupBy';

const { Column, HeaderCell, Cell } = Table;
const CompactCell = props => {
    if(props.dataKey === 'entity'){
        return <Cell {...props} style={{ padding: 4 }}>
                <b>{props.rowData.entity}</b>
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
    if(props.dataKey === 'category'){
        return <Cell {...props} style={{ fontSize: '12px', padding: 4 }}>
                <code>
                    {props.rowData.category}                    
                </code>
            </Cell>;
    }
    if(props.dataKey === "traits"){
        return <Cell {...props} style={{ fontSize: '12px', padding: 4 }}>
                    <Stack direction='column' alignItems="flex-start" spacing={4}>
                    {
                        props.rowData.traits.map(elem=> {
                            return <Tag size='sm' style={{border: 'solid 0.5px grey', fontSize: '11px', padding: '2px !important'}}>
                                        <b>Trait:</b> <code>{elem.name}</code>, <b>Confidence: </b><code>{elem.score}</code>
                                    </Tag>
                        })
                    }
                    </Stack>
                </Cell>
    }
    return <Cell {...props} style={{ fontSize: '12px', padding: 4 }} />;
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
      key: 'entity',
      label: 'Entity',
      flexGrow: 2,
      verticalAlign: 'middle'
    },
    {
      key: 'entity_type',
      label: 'Entity Type',
      flexGrow: 2,
      verticalAlign: 'middle'    
    },
    {
      key: 'category',
      label: 'Category',
      width: 0,
      verticalAlign: 'middle'
    },
    {
      key: 'score',
      label: 'Confidence',      
      flexGrow: 1,
      verticalAlign: 'middle',
      visible: false
    },
    {
      key: 'traits',
      label: 'Traits',  
      flexGrow: 2,
      verticalAlign: 'middle'
    }
  ];

const PiiDisplay = () => {
    const [columnKeys] = useState(defaultColumns.map(column => column.key));
    const columns = defaultColumns.filter(column => columnKeys.some(key => key === column.key));
    const [data, setdata] = useState(undefined)    

    
    useEffect(() => {
      const entities = compmeddata["Entities"];
      const dataset = [];
      for(const entity of entities){
        let ent = {};
        ent["entity"] = entity["Text"];
        ent["entity_type"] = entity["Type"];
        ent["score"] = parseInt(entity["Score"].toPrecision(2) * 100,10)+"%";
        ent["category"] = entity["Category"];
        let traits = entity["Traits"], trait_list = [];
        if(traits.length > 0){
            for(const tr of traits){
                const trt = {}
                trt["name"] = tr["Name"];
                trt["score"] = parseInt(tr["Score"].toPrecision(2) * 100,10)+"%"
                trait_list.push(trt);
            }            
        }
        ent["traits"] = trait_list; //.join(",");
        dataset.push(ent)
      }
      const grouped = groupBy(dataset, elem => elem.category);
      console.log(grouped)
      setdata(grouped);
    }, [])
    
    return (
        <div>        
            <Grid fluid>
                <Row gutter={22}>
                    <Col xxl={12} xl={12} lg={24} xs={24} sm={24} md={8} >
                        <div style={{height: '100vh', border: 'solid 1px black'}}>
                            {/* <iframe title='test-pdf' src={`${testPdf}#view=fitH`} style={{height: '100%', width: '50%'}}/> */}
                            <embed src={`${testPdf}#view=fitH`} style={{height: '100%', width: '100%'}}/>
                        </div>
                    </Col>
                    <Col xxl={12} xl={12} lg={24} xs={24} sm={24} md={8} style={{height: '100vh',overflowY: 'scroll'}}>
                        {
                            (data)&&
                            Object.keys(data).map((category, i) => {
                                return <div key={`${category}-${i}`} direction='column' alignItems="flex-start" spacing={8}>
                                            <div style={{margin: '16px 0px 8px 0px'}}>Entity Category: <Tag color="cyan" size="lg">{category}</Tag></div>
                                            <Table                                               
                                                hover={true}
                                                showHeader={true}              
                                                autoHeight
                                                affixHeader
                                                data={data[category]}
                                                cellBordered={false}
                                                headerHeight={40}
                                                rowHeight={60}                
                                            >
                                            {columns.map(column => {
                                                const { key, label, ...rest } = column;
                                                return (
                                                <Column {...rest} key={`${key}-${category}`}>
                                                    <CompactHeaderCell>{label}</CompactHeaderCell>
                                                    <CompactCell dataKey={key} />
                                                </Column>
                                                );
                                            })}
                                            </Table>
                                        </div>
                            })
                        }
                    </Col>        
                </Row>
            </Grid>
        </div> 
    )
}

export default PiiDisplay