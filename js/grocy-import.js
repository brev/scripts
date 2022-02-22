#!/usr/bin/env node

const Database = require('better-sqlite3')
const parse = require('csv-parse/lib/sync')
const { readFileSync } = require('fs')
const uniqid = require('uniqid')

// Prep
const input = readFileSync('./stock_log.csv')
const records = parse(input, { skip_empty_lines: true })
const headers = records.shift()
const db = new Database('./grocy.db', /*{ verbose: console.log }*/)

// Methods
const delete_stock = db.prepare(`
  DELETE FROM stock WHERE id = ?
`)
const insert_stock_log = db.prepare(`
  INSERT INTO stock_log VALUES (${(new Array(21)).fill('?').join(',')})
`)
const insert_stock = db.prepare(`
  INSERT INTO stock VALUES (${(new Array(12)).fill('?').join(',')})
`)
const select_stocks_product = db.prepare(`
  SELECT * FROM stock WHERE product_id = ? ORDER BY amount DESC
`)
const update_stock_amount = db.prepare(`
  UPDATE stock SET amount = ? WHERE id = ?
`)
const stock_log_to_stock = (record) => {
  return record.filter((value, index) => {
    return ![5, 6, 8, 11, 15, 16, 17, 18, 20].includes(index)
  })
}

// Main
//headers.forEach((header, index) => console.log(index, header))
db.prepare('BEGIN').run()
records.every((record) => {
  // normalize
  record.forEach((column, index) => {
    if (column === '') record[index] = null
  })
  record[17] = uniqid() // transaction_id

  // inventory + or -
  if (record[8] === 'purchase') { // transaction_type
    // inventory +
    record[7] = uniqid() // stock_id
    insert_stock_log.run(record) 
    record = stock_log_to_stock(record)
    insert_stock.run(record) 
  }
  else if (record[8] === 'consume') { // transaction_type
    // inventory -
    let amount = parseInt(record[2])
    let total = 0

    const stocks = select_stocks_product.all(record[1])
    stocks.forEach((stock) => {
      stock.amount = parseInt(stock.amount)
      total += stock.amount
    })

    console.log('product_id:', record[1], 'amount:', Math.abs(amount), 'total:', total, stocks.map(i => i.id))

    if (Math.abs(amount) > total) {
      // don't have total
      console.error(`
        Tried to consume ${Math.abs(amount)}, total is ${total}! 
        Not enough total!
        ${record.toString()}
      `)
      process.exit(1)
    }

    while (Math.abs(amount) > 0) {
      const stockMonad = stocks.shift()
      console.log('  monad = ', stockMonad.id, stockMonad.amount)
      record[7] = stockMonad.stock_id
      insert_stock_log.run(record) 

      if (Math.abs(amount) >= stockMonad.amount) {
        // remove stock entry
        console.log('    before-remove:', 'amount:', amount, 'stockMonadAmount:', stockMonad.amount)
        delete_stock.run(stockMonad.id);
        amount += stockMonad.amount
        console.log('    remove! amount_left:', amount, 'stock_left: 0')
      } 
      else {
        // reduce stock entry
        const newAmount = stockMonad.amount + amount
        update_stock_amount.run(newAmount, stockMonad.id)
        amount = 0
        console.log('    reduce! amount_left:', amount, 'stock_left:', newAmount)
      }
    }
  }

  return true // continue
})

db.prepare('COMMIT').run()
//db.prepare('ROLLBACK').run()
db.close()

