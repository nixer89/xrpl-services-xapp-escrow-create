import { XummTypes } from 'xumm-sdk';

export interface GenericBackendPostRequestOptions {
    frontendId?: string,
    web?: boolean,
    pushDisabled?: boolean,
    referer?: string,
    xrplAccount?: string,
    signinToValidate?: boolean,
    issuing?: boolean,
    isRawTrx?: boolean
}

export interface GenericBackendPostRequest {
    options?: GenericBackendPostRequestOptions,
    payload: XummTypes.XummPostPayloadBodyJson
}

export interface TransactionValidation {
    success: boolean,
    testnet: boolean,
    txid?: string,
    error?: boolean,
    message?: string,
    payloadExpired?: boolean,
    noValidationTimeFrame?: boolean,
    redirect?: boolean,
    account?: string,
    payloadId?: string
}

export interface AccountInfoChanged {
    info: any,
    mode: boolean
}

export interface AccountObjectsChanged {
    object: any,
    mode: boolean
}

export interface XrplAccountChanged {
    account: string,
    mode: boolean
}

export interface Token {
    currency: string,
    amount: string,
    trustlines?: string
}

export interface TrustLine {
    account:string,
    balance: string,
    currency: string,
    limit: string,
    limit_peer: string,
    no_ripple: boolean,
    balanceN?: number,
    limitN?: number
}

export interface TransactionTemplate {
    transactionType: string,
    docLink: string,
    requiresAmendment: boolean,
    codeSamples: any[]
}

export interface TokenIssuer {
    account: string,
    currency: string,
    amount: string,
    trustlines: string,
    verified: boolean,
    username?: string,
    resolvedBy?: string
    twitter?: string,
    domain?: string
}

export interface IssuerVerification {
    resolvedBy: string,
    account: string,
    verified: boolean
    domain?: string,
    username?: string,
    twitter?: string
}

export interface RippleState {
    Balance: {
        currency: string,
        issuer: string,
        value: string
    },
    Flags: number,
    HighLimit: {
        currency: string,
        issuer: string,
        value: string
    },
    HighNode: string,
    LedgerEntryType: string,
    LowLimit: {
        currency: string,
        issuer: string,
        value: string
    },
    LowNode: string,
    PreviousTxnID: string,
    PreviousTxnLgrSeq: number,
    index: string,
    LockCount?: number,
    LockedBalance?: {
        currency: string,
        issuer: string,
        value: string
    }
}


export interface SimpleTrustline {
    issuer: string,
    currency: string,
    currencyShow: string,
    balance: number,
    balanceShow: number,
    lockedBalance: number,
    limit: number,
    limitShow:number,
    isFrozen: boolean,
    name?: string
}