const { ethers } = require('ethers');
const ERC20Adapter = require('../adapters/erc20-usdc');

async function main(){
  // Uses Polygon Mumbai public RPC for quick test (read-only)
  const provider = new ethers.providers.JsonRpcProvider('https://rpc-mumbai.maticvigil.com');
  const usdcAddress = '0x0000000000000000000000000000000000000000'; // replace with test USDC on Mumbai
  const adapter = new ERC20Adapter(provider, usdcAddress);
  try{
    const symbol = await adapter.getSymbol();
    const decimals = await adapter.getDecimals();
    console.log('symbol', symbol, 'decimals', decimals);
  }catch(err){
    console.error('Read test failed - replace token address with a Mumbai USDC address', err.message);
    process.exit(1);
  }
}

main();
