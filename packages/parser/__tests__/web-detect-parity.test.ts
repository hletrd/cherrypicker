import { describe, test, expect } from 'bun:test';
import { detectFormatFromFile, detectBank } from '../../../apps/web/src/lib/parser/detect.ts';

describe('detectFormatFromFile (C21-TEST04)', () => {
  test('detects xlsx from .xlsx extension', async () => {
    const file = new File([''], 'test.xlsx');
    expect(await detectFormatFromFile(file)).toBe('xlsx');
  });

  test('detects xlsx from .xls extension', async () => {
    const file = new File([''], 'test.xls');
    expect(await detectFormatFromFile(file)).toBe('xlsx');
  });

  test('detects pdf from .pdf extension', async () => {
    const file = new File([''], 'test.pdf');
    expect(await detectFormatFromFile(file)).toBe('pdf');
  });

  test('detects json from .json extension', async () => {
    const file = new File([''], 'test.json');
    expect(await detectFormatFromFile(file)).toBe('json');
  });

  test('detects ofx from .ofx extension', async () => {
    const file = new File([''], 'test.ofx');
    expect(await detectFormatFromFile(file)).toBe('ofx');
  });

  test('detects ofx from .qfx extension', async () => {
    const file = new File([''], 'test.qfx');
    expect(await detectFormatFromFile(file)).toBe('ofx');
  });

  test('detects html from .html extension', async () => {
    const file = new File([''], 'test.html');
    expect(await detectFormatFromFile(file)).toBe('html');
  });

  test('detects html from .htm extension', async () => {
    const file = new File([''], 'test.htm');
    expect(await detectFormatFromFile(file)).toBe('html');
  });

  test('defaults to csv for unknown extension', async () => {
    const file = new File([''], 'test.txt');
    expect(await detectFormatFromFile(file)).toBe('csv');
  });

  test('defaults to csv for no extension', async () => {
    const file = new File([''], 'test');
    expect(await detectFormatFromFile(file)).toBe('csv');
  });

  // Content sniffing tests (C21-02)
  test('sniffs PDF from %PDF magic', async () => {
    const file = new File(['%PDF-1.4\n1 0 obj'], 'test.txt');
    expect(await detectFormatFromFile(file)).toBe('pdf');
  });

  test('sniffs OFX from <?OFX header', async () => {
    const file = new File(['<?OFX OFXHEADER="200" VERSION="220"?>\n<OFX></OFX>'], 'test.txt');
    expect(await detectFormatFromFile(file)).toBe('ofx');
  });

  test('sniffs OFX from <OFX tag', async () => {
    const file = new File(['<OFX>\n<BANKTRANLIST>\n</BANKTRANLIST>\n</OFX>'], 'test.dat');
    expect(await detectFormatFromFile(file)).toBe('ofx');
  });

  test('sniffs HTML from <!DOCTYPE html', async () => {
    const file = new File(['<!DOCTYPE html>\n<html><body>test</body></html>'], 'test.txt');
    expect(await detectFormatFromFile(file)).toBe('html');
  });

  test('sniffs HTML from <html tag', async () => {
    const file = new File(['<html><body>test</body></html>'], 'test.dat');
    expect(await detectFormatFromFile(file)).toBe('html');
  });

  test('sniffs HTML from <table tag', async () => {
    const file = new File(['<table><tr><td>test</td></tr></table>'], 'test.txt');
    expect(await detectFormatFromFile(file)).toBe('html');
  });

  test('sniffs JSON from array', async () => {
    const file = new File(['[{"date":"2024-01-15","amount":10000}]'], 'test.txt');
    expect(await detectFormatFromFile(file)).toBe('json');
  });

  test('sniffs JSON from object', async () => {
    const file = new File(['{"transactions":[{"date":"2024-01-15"}]}'], 'test.txt');
    expect(await detectFormatFromFile(file)).toBe('json');
  });

  test('sniffs XML-OFX from <?xml + OFX tags', async () => {
    const file = new File(['<?xml version="1.0"?>\n<OFX>\n<BANKTRANLIST>\n</BANKTRANLIST>\n</OFX>'], 'test.xml');
    expect(await detectFormatFromFile(file)).toBe('ofx');
  });

  test('sniffs BOM-prefixed JSON', async () => {
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const content = Buffer.concat([bom, Buffer.from('[{"date":"2024-01-15"}]')]);
    const file = new File([content], 'test.txt');
    expect(await detectFormatFromFile(file)).toBe('json');
  });
});

describe('detectBank (C21-TEST04)', () => {
  test('detects KB from content', () => {
    const { bank, confidence } = detectBank('KB국민카드 이용내역\n거래일시,가맹점명,이용금액');
    expect(bank).toBe('kb');
    expect(confidence).toBeGreaterThan(0);
  });

  test('detects shinhan from content', () => {
    const { bank } = detectBank('신한카드 이용내역\n이용일,이용처,이용금액');
    expect(bank).toBe('shinhan');
  });

  test('detects hyundai from content', () => {
    const { bank } = detectBank('현대카드 이용내역');
    expect(bank).toBe('hyundai');
  });

  test('returns null for unrecognized content', () => {
    const { bank, confidence } = detectBank('거래일시,금액,가맹점');
    expect(bank).toBeNull();
    expect(confidence).toBe(0);
  });

  test('confidence is higher when multiple patterns match', () => {
    const { confidence: c1 } = detectBank('신한카드');
    const { confidence: c2 } = detectBank('신한카드 SHINHAN');
    expect(c2).toBeGreaterThan(c1);
  });

  // C70-01: Single-pattern bank confidence capping
  test('caps confidence for single-pattern banks', () => {
    const { confidence } = detectBank('신협');
    // cu has only one pattern (/신협/), so confidence should be capped at 0.5
    expect(confidence).toBeLessThanOrEqual(0.5);
  });

  test('multi-pattern banks can reach full confidence', () => {
    const { confidence } = detectBank('KB국민카드 국민카드 kbcard');
    // kb has 3 patterns, all matched → confidence = 1.0
    expect(confidence).toBe(1);
  });
});
