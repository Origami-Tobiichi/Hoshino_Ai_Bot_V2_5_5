/**
 * ✧ Name     : integritytest
 * ✧ Category : owner
 * ✧ Type     : Standalone Local Integrity Test
 * ✧ Usage    : .integritytest
 *
 * TEST:
 *   .integritytest
 *   .integritytest tamper
 */

'use strict'

const crypto = require('crypto')

/* =========================================================
 * IDENTITAS PROYEK
 * ========================================================= */

const PROJECT = 'HOSHINO-TTTMP'
const VERSION = '1.0.0'

const WM = 'MBHoshinoAiPost'

const TYPENAME =
    'GenAIaeacdsnwHtmlPrimitive'

/* =========================================================
 * SIGNATURE ASLI
 * ========================================================= */

const EXPECTED_SIGNATURE =
    'fff83ed907a47906942b8d978a8fda6a9fb8931dfd248d10bd7bccd61b13c80e'

/* =========================================================
 * CANONICAL DATA
 * ========================================================= */

function createCanonical(
    project,
    version,
    wm,
    typename
) {

    return [
        project,
        version,
        wm,
        typename
    ].join('|')

}

/* =========================================================
 * CALCULATE SIGNATURE
 * ========================================================= */

function calculateSignature(
    project = PROJECT,
    version = VERSION,
    wm = WM,
    typename = TYPENAME
) {

    return crypto
        .createHash('sha256')
        .update(
            createCanonical(
                project,
                version,
                wm,
                typename
            )
        )
        .digest('hex')

}

/* =========================================================
 * CHECK INTEGRITY
 * ========================================================= */

function checkIntegrity() {

    const actual =
        calculateSignature()

    return {

        valid:
            actual ===
            EXPECTED_SIGNATURE,

        expected:
            EXPECTED_SIGNATURE,

        actual,

        project:
            PROJECT,

        version:
            VERSION,

        wm:
            WM,

        typename:
            TYPENAME

    }

}

/* =========================================================
 * SHORT SIGNATURE
 * ========================================================= */

function shortSignature(
    signature
) {

    return (
        signature.slice(0, 24) +
        '...'
    )

}

/* =========================================================
 * HANDLER
 * ========================================================= */

async function handler(
    m,
    { args }
) {

    const mode =
        String(
            args?.[0] || ''
        ).toLowerCase()

    /* =====================================================
     * TAMPER TEST
     * ===================================================== */

    if (
        mode === 'tamper'
    ) {

        const originalWM =
            WM

        const tamperedWM =
            'MBNixelPost'

        const tamperedSignature =
            calculateSignature(
                PROJECT,
                VERSION,
                tamperedWM,
                TYPENAME
            )

        const detected =
            tamperedSignature !==
            EXPECTED_SIGNATURE

        return m.reply(

            '*❌ TAMPER TEST*\n\n' +

            'Project : ' +
            PROJECT +
            '\n' +

            'Version : ' +
            VERSION +
            '\n' +

            'WM      : ' +
            tamperedWM +
            '\n\n' +

            'Signature asli :\n`' +
            shortSignature(
                EXPECTED_SIGNATURE
            ) +
            '`\n\n' +

            'Signature setelah perubahan :\n`' +
            shortSignature(
                tamperedSignature
            ) +
            '`\n\n' +

            'Status : ' +
            (
                detected
                    ? '*TAMPERED* ❌'
                    : '*VALID* ⚠️'
            ) +

            '\n\n' +

            'Simulasi:\n`' +
            originalWM +
            '` → `' +
            tamperedWM +
            '`' +

            '\n\n' +

            (
                detected
                    ? '🛡️ Perubahan berhasil terdeteksi.'
                    : '⚠️ Perubahan tidak terdeteksi.'
            )

        )

    }

    /* =====================================================
     * NORMAL TEST
     * ===================================================== */

    const result =
        checkIntegrity()

    if (
        !result.valid
    ) {

        return m.reply(

            '*❌ INTEGRITY FAILED*\n\n' +

            'Project : ' +
            result.project +
            '\n' +

            'Version : ' +
            result.version +
            '\n' +

            'WM      : ' +
            result.wm +
            '\n' +

            'Type    : ' +
            result.typename +
            '\n\n' +

            'Expected :\n`' +
            shortSignature(
                result.expected
            ) +
            '`\n\n' +

            'Actual :\n`' +
            shortSignature(
                result.actual
            ) +
            '`\n\n' +

            'Status : *TAMPERED* ❌\n' +

            'Info : Signature tidak cocok.'

        )

    }

    return m.reply(

        '*✅ INTEGRITY TEST*\n\n' +

        'Project : ' +
        result.project +
        '\n' +

        'Version : ' +
        result.version +
        '\n' +

        'WM      : ' +
        result.wm +
        '\n' +

        'Type    : ' +
        result.typename +
        '\n\n' +

        'Signature :\n`' +
        shortSignature(
            result.actual
        ) +
        '...`\n\n' +

        'Status : *VALID* ✅\n' +

        'Info : Signature valid.'

    )

}

/* =========================================================
 * PLUGIN CONFIG
 * ========================================================= */

const pluginConfig = {

    name:
        'integritytest',

    alias: [
        'integrity',
        'itest'
    ],

    category:
        'owner',

    description:
        'Tes integritas WM dan identitas fitur secara lokal.',

    usage:
        '.integritytest',

    example:
        '.integritytest',

    isOwner:
        true,

    isPremium:
        false,

    isGroup:
        false,

    isPrivate:
        false,

    cooldown:
        5,

    energi:
        0,

    isEnabled:
        true

}

/* =========================================================
 * EXPORT
 * ========================================================= */

module.exports = {

    config:
        pluginConfig,

    handler

}