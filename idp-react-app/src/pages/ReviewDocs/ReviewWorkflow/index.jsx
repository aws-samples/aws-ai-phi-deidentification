/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import React from 'react';
import { useParams } from 'react-router-dom';
import {   
    Steps,
    Nav,
    Breadcrumb,
    Container, 
    Header, 
    Content,
    Loader} from 'rsuite'; 
import { Link } from 'react-router-dom';
import { useWorkflows } from 'src/hooks/useWorkflows';
import AngleRightIcon from '@rsuite/icons/legacy/AngleRight';
import Textract from './textract';
import PhiTab from './phi';
import CheckRoundIcon from '@rsuite/icons/CheckRound';
import WarningRoundIcon from '@rsuite/icons/WarningRound';
import './styles.less'

const NavLink = React.forwardRef(({ href, children, ...rest }, ref) => (
    <Link ref={ref} to={href} {...rest}>
      {children}
    </Link>
  ));

const LeadBreadcrumb = props => {
    return <Breadcrumb className='rwf-bc' separator={<AngleRightIcon/>}>            
            <Breadcrumb.Item as={NavLink} href="/review">Analysis Jobs</Breadcrumb.Item>
            <Breadcrumb.Item active>{props.wfid}</Breadcrumb.Item>
          </Breadcrumb>
}



const ReviewWorkflow = () => {
    const [active, setActive] = React.useState('textract');
    const {wfid} = useParams();
    const { data, isError, isFetching } = useWorkflows("workflow-list-exact", wfid);

    const progress = () => {      
      const val = (data.phi_data.de_identification_status === "processing" || data.phi_data.de_identification_status === "failed")? 1: 2; 
      const phi_icon = (data.phi_data.de_identification_status === "processing")? <Loader size="sm" inverse/>//<ReloadIcon spin style={{ fontSize: '1.2em', color: 'white' }}/>
                      :(data.phi_data.de_identification_status === "failed")? <WarningRoundIcon style={{ fontSize: '1.2em', color: '#FF1744' }}/> 
                      :<CheckRoundIcon style={{ fontSize: '1.2em', color: '#00E676' }}/>;
      const phi_description = (data.phi_data.de_identification_status === "processing")? <span style={{color: 'white'}}>In progress</span>
                            :(data.phi_data.de_identification_status === "failed")? <span style={{color: 'white'}}>Failed</span>
                            :<span style={{color: 'white'}}>Complete</span>
      return <Steps current={val} small style={{color: 'white', marginTop: '4px'}}>
              <Steps.Item 
                  title={<span style={{color: 'white'}}>Bulk OCR</span>} 
                  icon={<CheckRoundIcon style={{ fontSize: '1.2em', color: '#00E676' }}/>} 
                  description={<span style={{color: 'white'}}>Complete</span>}/>
              <Steps.Item 
                  title={<span style={{color: 'white'}}>PHI de-identification</span>} 
                  icon={phi_icon}
                  description={phi_description}/>
              <Steps.Item title={<span style={{color: 'white'}}>Complete</span>} icon={(val === 2)?<CheckRoundIcon style={{ fontSize: '1.2em', color: '#00E676' }}/>:undefined}/>
            </Steps>
    }

    return (
        <Container>
            <Header className='rwf-header'>
            <div>
                <h4>Analysis Job - {wfid}</h4>
                {
                  (data)&&
                  progress()
                }
            </div>
            </Header>
            
            <LeadBreadcrumb wfid={wfid}/>
            
            <Content className='rwf-content'>                
                <Nav appearance="tabs" activeKey={active} onSelect={setActive} style={{ marginBottom: 10 }}>
                  <Nav.Item eventKey="textract">Extracted Text</Nav.Item>
                  <Nav.Item eventKey="phi">De-identified documents</Nav.Item>
                </Nav>
                {
                  (active === 'textract')&&
                  <Textract/>
                }  
                {
                  (active === 'phi')&&
                  <PhiTab/>
                }            
            </Content>            
        </Container>
    )
}

export default ReviewWorkflow;