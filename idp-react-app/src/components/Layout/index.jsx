/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import React from 'react';
import { Container, Header, Sidebar, Sidenav, Content, Navbar, Nav } from 'rsuite';
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import CreativeIcon from '@rsuite/icons/Creative';
import FileUpload from '@rsuite/icons/FileUpload';
import TableColumn from '@rsuite/icons/TableColumn';
import Exit from '@rsuite/icons/Exit';
import Admin from '@rsuite/icons/Admin';
import AngleLeftIcon from '@rsuite/icons/legacy/AngleLeft';
import AngleRightIcon from '@rsuite/icons/legacy/AngleRight';
import logo from 'src/assets/logo.png';
import './styles.css';
import './container.less';

const headerStyles = {
  padding: 18,
  height: 56,
  background: '#252F3D',  
  display: 'flex',
  alignItems: 'center',
  flexDirection: 'row',
  color: ' #fff',
  whiteSpace: 'nowrap',
  overflow: 'hidden'
};

const NavToggle = ({ expand, onChange }) => {
    return (
      <Navbar appearance="subtle" className="nav-toggle">        
        <Nav pullRight>
          <Nav.Item onClick={onChange} style={{ width: 56, textAlign: 'center' }}>
            {expand ? <AngleLeftIcon /> : <AngleRightIcon />}
          </Nav.Item>
        </Nav>
      </Navbar>
    );
  };

const Layout = ({user, signOut}) => {
    const [expand, setExpand] = React.useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    return (
      <div className="show-fake-browser sidebar-page">
        <Container>
          <Sidebar
            style={{ display: 'flex', flexDirection: 'column', position: 'fixed', zIndex: 110 }}
            width={expand ? 260 : 56}
            collapsible
          >
            <Sidenav.Header>              
              <div style={headerStyles}>                
                  <img src={logo} style={{width: '30px', marginLeft: '-4px', marginRight: '12px'}} alt="IDP"/>                                
                  <span ><b>Intelligent Document <br/> Processing (IDP)</b></span>                
              </div>
            </Sidenav.Header>
            <Sidenav expanded={expand}>
              <Sidenav.Body>
                <Nav>
                    <Nav.Item eventKey="1" active={(location.pathname === "/")} icon={<CreativeIcon />} onClick={() => navigate("/")}>                    
                        Home                   
                    </Nav.Item>
                    <Nav.Item eventKey="2" active={(location.pathname === "/process")} icon={<FileUpload />} onClick={() => navigate("/process")}>                    
                            Process Documents                    
                    </Nav.Item>
                    <Nav.Item eventKey="3" active={(location.pathname === "/review")} icon={<TableColumn />} onClick={() => navigate("/review")}>                      
                            Analysis Jobs
                    </Nav.Item>                  
                </Nav>
              </Sidenav.Body>
            </Sidenav>       
            <NavToggle expand={expand} onChange={() => setExpand(!expand)} />    
          </Sidebar>
  
          <Container>
            <Header style={{width: '100%', background: '#252F3D', position: 'fixed', top: 0, zIndex: 99}}>
                <Navbar appearance="inverse" style={{background: '#252F3D', paddingRight: '8px'}}>                    
                    <Nav pullRight>
                        <Nav.Menu icon={<Admin/>} title={user.attributes.email.split('@')[0]}>
                            <Nav.Item icon={<Exit />} onClick={signOut} className="header-menu">Sign out</Nav.Item>
                        </Nav.Menu>                        
                    </Nav>
                </Navbar>
            </Header>
            <Content style={{marginLeft: (expand) ? 260 : 56}}>
                <Outlet/>
            </Content>
          </Container>
        </Container>
      </div>
    );
}

export default Layout;