/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

import React from 'react';
import { Tooltip } from 'rsuite';

const linkStyle = {color: '#fff', marginLeft: '2px'};

export const ClassifierTooltip = (
    <Tooltip>
        Amazon Comprehend classifier ARN in case you want to classify input documents. 
        <a href="https://docs.aws.amazon.com/comprehend/latest/dg/how-document-classification.html" target="_blank" rel="noreferrer" style={linkStyle}><u>Learn more</u></a>
    </Tooltip>
);

export const ErTooltip = (
      <Tooltip>
          Amazon Comprehend custom entity recognizer ARN in case you want to extract custom entites from documents. 
          <a href="https://docs.aws.amazon.com/comprehend/latest/dg/custom-entity-recognition.html" target="_blank" rel="noreferrer" style={linkStyle}><u>Learn more</u></a>
      </Tooltip>
);