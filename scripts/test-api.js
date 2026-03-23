// Test directo al API
const http = require('http');

const options = {
  hostname: '104.196.109.37',
  port: 3001,
  path: '/api/saldos-actuales/fa75bb3a-e881-471a-b558-749b0f0de0ff?reconciliar=true',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer test', // El middleware puede rechazar esto, pero veremos
    'Cache-Control': 'no-cache'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('\nRespuesta del servidor:');
      
      if (json.saldos) {
        const eur = json.saldos.find(s => s.moneda_codigo === 'EUR');
        const usd = json.saldos.find(s => s.moneda_codigo === 'USD');
        
        if (eur) {
          console.log(`EUR: ${eur.saldo} (calculado: ${eur.saldo_calculado}, dif: ${eur.diferencia})`);
        }
        if (usd) {
          console.log(`USD: ${usd.saldo} (calculado: ${usd.saldo_calculado}, dif: ${usd.diferencia})`);
        }
      } else {
        console.log('No hay saldos en la respuesta');
        console.log(json);
      }
    } catch (e) {
      console.log('Error parseando respuesta:', e.message);
      console.log('Raw:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
});

req.end();
