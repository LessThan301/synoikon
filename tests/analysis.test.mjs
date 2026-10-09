import { buildNetwork, tokenize } from '../js/analysis.js';
import { STOP_EN } from '../js/stopwords.js';
const docs = [
  { text: 'The river flows into the sea. A river bank is muddy; the river delta is wide.' },
  { text: 'Rivers carry water from mountains to the sea, forming a delta near the bank.' },
  { text: 'Fishing on the river bank at dawn. The river water was cold.' },
];
const net = buildNetwork(docs, 'river', { window: 4, topN: 10, minCooc: 1, stop: STOP_EN });
console.log(JSON.stringify(net.stats), net.nodes.map(n => `${n.label}:${n.freq}/${n.cooc}`).join(' '));
console.log(net.links.map(l => `${l.source}-${l.target}:${l.weight}`).join(' '));
console.log(tokenize("Rhein's Ufer, über-Flut 2024"));
