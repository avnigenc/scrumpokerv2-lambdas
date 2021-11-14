#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { ScrumPokerV2Stack } from '../lib/scrum-poker-v2-stack';

const app = new cdk.App();
new ScrumPokerV2Stack(app, 'ScrumPokerV2Stack', {
    stackName: 'scrum-pokerv2-stack',
    env: {
        region: 'eu-west-1',
    }
});
app.synth();