import {startEngine} from './engine.js';
import {GM,bridge} from '../shared/bridge';
void startEngine(GM,bridge).catch(e=>console.error('Y!News Filter Plus:',e));
