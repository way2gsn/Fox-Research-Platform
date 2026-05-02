import http from 'http';
import fs from 'fs';
http.get('http://localhost:3000/projects/3', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    fs.writeFileSync('dom.html', data);
    console.log('Saved dom.html, length:', data.length);
  });
});
