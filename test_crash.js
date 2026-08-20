const { app, utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  fs.writeFileSync('child.js', 'process.exit(1);');
  
  const child = utilityProcess.fork(path.join(__dirname, 'child.js'), [], { stdio: 'pipe' });
  
  child.stderr.on('data', data => console.log('STDERR:', data.toString()));
  child.stdout.on('data', data => console.log('STDOUT:', data.toString()));
  child.on('exit', (code) => {
    console.log('EXIT:', code);
    app.quit();
  });
});
