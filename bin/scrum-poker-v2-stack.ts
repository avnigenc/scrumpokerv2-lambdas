#!/usr/bin/env node
import { App } from '@aws-cdk/core';
import { ScrumPokerV2Stack } from '../lib/scrum-poker-v2-stack';

const app = new App();
new ScrumPokerV2Stack(app, 'ScrumPokerV2StackNew', {
  stackName: 'scrum-pokerv2-stack-new',
  env: {
    region: 'eu-west-1',
  },
});
app.synth();
