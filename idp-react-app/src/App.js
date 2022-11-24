/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import React, { Suspense }  from 'react';
import { withAuthenticator} from '@aws-amplify/ui-react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from 'src/components/Layout';
import Spinner from 'src/components/Spinner'
import '@aws-amplify/ui-react/styles.css';
import './App.less';
import 'rsuite/styles/index.less';
import logo from 'src/assets/logo.png';

const ProcessDocs =  React.lazy(() => import('./pages/ProcessDocs'));
const ReviewDocs = React.lazy(() => import('./pages/ReviewDocs'));
const ReviewWf = React.lazy(() => import('./pages/ReviewDocs/ReviewWorkflow'));
const Home = React.lazy(() => import('src/pages/Home'));

const queryClient = new QueryClient();

function App({ signOut, user }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout user={user} signOut={signOut}/>}>
            <Route path="/" element={<Suspense fallback={<Spinner/>}>
                                            <Home/>
                                      </Suspense>} />
            <Route path="/process" element={<Suspense fallback={<Spinner/>}>
                                                <ProcessDocs endToend={false}/>
                                            </Suspense>} />
            <Route path="/review" element={<Suspense fallback={<Spinner/>}>
                                                <ReviewDocs/>
                                          </Suspense>} />
            <Route path="/review/wf/:wfid" element={<Suspense fallback={<Spinner/>}>
                                                        <ReviewWf/>
                                                    </Suspense>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

const loginComponents = {
  Header: () => <div className='login-header'>
                  <img src={logo} style={{width: '70px'}} alt="aws_logo" />
                  <h4>Intelligent Document Processing (IDP)</h4>
                </div>
}

export default withAuthenticator(App, {
  variation: 'default',
  hideSignUp: true,
  components: loginComponents
});
