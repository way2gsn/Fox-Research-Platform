const http = require('http');
http.get('http://localhost:3000/projects/3', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Length:', data.length);
    const fs = require('fs');
    fs.writeFileSync('dom.html', data);
  });
});
