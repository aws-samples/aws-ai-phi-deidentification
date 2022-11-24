/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import React from 'react';
import CircleSpinner from '@rsuite/icons/legacy/CircleONotch'

const Spinner = () => {
  return (
    <div style={{display: 'block', textAlign: 'center', marginTop: '50px'}}>
        <CircleSpinner spin style={{ fontSize: '2.5em', color: '#9E9E9E' }} />
    </div>
  )
}

export default Spinner