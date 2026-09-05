/* Собирает автономную HTML-страницу с обеими схемами (для публикации/просмотра). */
const fs = require('fs'), path = require('path');
const here = __dirname, root = path.join(here, '..');
const assets = process.argv[2]; // путь к bpmn-js/dist/assets
const css = ['diagram-js.css', 'bpmn-js.css', 'bpmn-font/css/bpmn-embedded.css']
  .map(f => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n');
const page = fs.readFileSync(path.join(here, 'page-template.html'), 'utf8')
  .replace('/*__BPMN_CSS__*/', css)
  .replace('/*__XML_AS_IS__*/', fs.readFileSync(path.join(root, 'vkr-process-as-is.bpmn'), 'utf8'))
  .replace('/*__XML_TO_BE__*/', fs.readFileSync(path.join(root, 'vkr-process-to-be.bpmn'), 'utf8'));
fs.writeFileSync(path.join(root, 'vkr-process-page.html'), page);
console.log('страница собрана:', Math.round(page.length / 1024), 'КБ');
