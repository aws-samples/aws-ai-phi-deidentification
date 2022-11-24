/*!
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
*/

const CracoLessPlugin = require('craco-less');
const path = require('path');

module.exports = {
  webpack: {
    configure: {
      devtool: 'eval-source-map',
      resolve: {
        alias:{
          src: path.resolve(__dirname, 'src')
        }
      }
    }
  },
  plugins: [
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            modifyVars: {
              '@base-color': '#FF9900',
              '@enable-ripple-effect': false,
              '@border-radius': '1px'
            },
            javascriptEnabled: true,
          },
        },
      },
    },
  ],
}