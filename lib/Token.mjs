// SPDX-License-Identifier: AGPL-3.0

/**
 *  Token.js
 *
 *  A wrapper around the ethers.js BigNumber object.
 *
 */

import { utils, constants, Contract, BigNumber } from 'ethers'

const guard = Symbol()

const expandToNDecimals = n => s => utils.parseUnits((s+'').split(' ').join(''), n)

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export class Token {

  constructor(
    { type = 'ERC20', chainId, address, name, symbol, decimals, formatSymbol },
    g,
    _isNative = false
  ) {

    if (g !== guard) throw new Error('[Token] no constructor direct call')

    // type Native / ERC20 / ERC721
    this.type = type
    this._isToken = true

    if (type === 'Native' || _isNative) {
      if (address) throw new Error('Native token have no address')
      this._isNative = true
    } else {
      this._isNative = false
      this.address = address
    }

    // check non optional properties
    this.chainId = chainId
    this.name = name
    this.symbol = symbol
    this.decimals = decimals
    this.formatSymbol = formatSymbol
  }

  expand(number) {
    return expandToNDecimals(this.decimals)(number)
  }

  newAmount(number, decimals) {
    if (number instanceof TokenAmount) {
      new TokenAmount({ token: this, number: BigNumber.from(number.number) }, guard)
    }

    if (!(number instanceof BigNumber)) {
      number = expandToNDecimals(decimals != null ? decimals : this.decimals)(number)
    }
    return new TokenAmount({ token: this, number: BigNumber.from(number) }, guard)
  }

  static native({ decimals = 18, ...defaults }) {
    return new Token({ decimals, ...defaults, type: 'Native' }, guard, true)
  }

  // replace from by erc20 etc...
  static from(value, defaults = {}) {
    if (value instanceof Token) { return value }

    if (value instanceof Contract) {
      return new Promise(function(resolve, reject) {
        Promise.all([
          value.name(),
          value.decimals(),
          value.symbol()

        ]).then(([ name, decimals, symbol ]) => {
          resolve(new Token({
            ...defaults,
            name,
            decimals,
            symbol,
            address: value.address,
          }, guard))
        })
      })
    }

    return new Token({ ...defaults, ...value }, guard)
  }

}

export const f = decimals => s =>
      utils.commify(utils.formatUnits((s+'').split(' ').join(''), decimals))

export const format = ({ decimals = 18 }, number = '0') => {
  return f(parseInt(decimals))(number)
}

export const formatAmount = ({ decimals = 18, symbol }, number = '0') => {
  return format({ decimals }, number) + ` ${symbol}`
}


const toTokenAmount = (any, token) => {
  if (any instanceof TokenAmount) return any
  return token.newAmount(any)
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export class TokenAmount {

  constructor({ token, number, tags = [] }, g) {
    if (g !== guard) throw new Error('[TokenAmount] no constructor direct call')

    this.token = token
    this.number = number
    this.tags = tags
    this._isTokenAmount = true
  }

  // TODO use set for tags
  addTag(tag) {
    this.tags = [ ...this.tags, tag ]
  }

  toFormat() {
    return format(this.token, this.number)
  }

  toString() {
    return formatAmount(this.token, this.number)
  }

  valueOf() {
    return this.number
  }

  xtoValue() {
    return this.number
  }

  delegate(call, arg) {
    return new TokenAmount({
      token: this.token,
      number: this.number[call](arg)
    }, guard)
  }

  add(any) { return this.delegate('add', toTokenAmount(any, this.token).number) }
  sub(any) { return this.delegate('sub', toTokenAmount(any, this.token).number) }

  eq(any) { return this.delegate('eq', toTokenAmount(any, this.token).number) }
  gt(any) { return this.delegate('gt', toTokenAmount(any, this.token).number) }
  gte(any) { return this.delegate('gte', toTokenAmount(any, this.token).number) }


  mul(any) { return this.delegate('mul', any) }

  static from(any, number) {
    if (any instanceof TokenAmount) return any.token.newAmount(number || any.number)

    if (any instanceof Contract) throw new Error('not yet supported')

    // convert back from JSON
    if (typeof any === 'object' && any._isTokenAmount) {
      return new TokenAmount({ token: Token.from(any.token), number: BigNumber.from(number || any.number) }, guard)
    }

    return Token.from(any).newAmount(number)
  }

}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


export class TokenAmountSet {

  constructor(map, g) {
    if (g !== guard) throw new Error('[TokenAmountSet] no constructor direct call')

    this.map = map
    this._isTokenAmountSet = true
  }

  values() {
    return Array.from(this.map.values())
  }

  toString(separator = ', ') {
    return this.values().join(separator)
  }

  add(amount) {
    if (!(amount instanceof TokenAmount)) throw new Error('can only add token amount in set')

    if (this.map.has(amount.token.address)) {
      this.map.set(
        amount.token.address, this.map.get(amount.token.address).add(amount.number)
      )
    } else {
      this.map.set(
        amount.token.address, amount.token.newAmount(amount.number)
      )
    }
  }

  static from(amountlist) {
    const set = new TokenAmountSet(new Map(), guard)

    amountlist.forEach( a => {
      set.add(a)
    })

    return set
  }

}

/*
map1.set('a', 1);
map1.set('b', 2);
map1.set('c', 3);

console.log(map1.get('a'));
// expected output: 1

map1.set('a', 97);

console.log(map1.get('a'));
// expected output: 97

console.log(map1.size);
// expected output: 3

map1.delete('b');

console.log(map1.size);
// expected output: 2
*/
