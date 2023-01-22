import { compareVersions } from 'compare-versions';

export const isFirstGreaterThanSecondVersion = (firstVersion = '', secondVersion = '') => compareVersions(firstVersion, secondVersion) === 1;

export const isFirstLesserThanSecondVersion = (firstVersion = '', secondVersion = '') => compareVersions(firstVersion, secondVersion) === -1;

export const isFirstEqualThanSecondVersion = (firstVersion = '', secondVersion = '') => compareVersions(firstVersion, secondVersion) === 0;
