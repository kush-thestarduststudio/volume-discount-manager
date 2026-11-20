async function run() {
  const shop = 'stardustt-studio.myshopify.com';
  // Let's check api.sync-discount response from scratch/check-live-discounts.js
  // It returned:
  // "metafields": {
  //   "data": {
  //     "metafieldsSet": {
  //       "metafields": [
  //         {
  //           "id": "gid://shopify/Metafield/192500826538036",
  //           "key": "config",
  //           "namespace": "app--447878725633--bundle_tiers"
  //         },
  //         {
  //           "id": "gid://shopify/Metafield/192500826570804",
  //           "key": "config",
  //           "namespace": "bundle_tiers"
  //         }
  //       ]
  //     }
  //   }
  // }
  console.log('Metafields exist!');
}
run();
