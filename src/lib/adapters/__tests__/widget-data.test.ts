/**
 * WidgetData Type Tests
 * 
 * Tests for WidgetData type guards and type system
 */

import { describe, it, expect } from 'vitest';
import {
  isSplashWidgetData,
  isReportWidgetData,
  isCollectionWidgetData,
  type WidgetData,
  type SplashWidgetData,
  type GridWidgetData,
  type CalendarWidgetData,
  type DoubleColumnWidgetData,
  type SingleColumnWidgetData,
  type VerticalTimelineWidgetData,
  type ReportWidgetData,
} from '../../../schema/ui/widget-data';

describe('WidgetData Type Guards', () => {
  describe('isSplashWidgetData', () => {
    it('should return true for valid SplashWidgetData', () => {
      const splash: SplashWidgetData = {
        variant: 'info',
        padding: 'lg',
        title: 'Test Title',
        subtitle: 'Test Subtitle',
        overlay: true,
        overlayOpacity: 'medium',
      };

      expect(isSplashWidgetData(splash)).toBe(true);
    });

    it('should return false for non-splash data', () => {
      const grid: GridWidgetData = {
        items: [],
      };

      expect(isSplashWidgetData(grid)).toBe(false);
    });
  });

  describe('isReportWidgetData', () => {
    it('should return true for valid ReportWidgetData', () => {
      const report: ReportWidgetData = {
        report: {
          name: 'Test Report',
          title: 'Test Report Title',
          period: 'Year',
          goal: 'Test Goal',
          categories: [],
        },
      };

      expect(isReportWidgetData(report)).toBe(true);
    });

    it('should return false for non-report data', () => {
      const grid: GridWidgetData = {
        items: [],
      };

      expect(isReportWidgetData(grid)).toBe(false);
    });
  });

  describe('isCollectionWidgetData', () => {
    it('should return true for GridWidgetData', () => {
      const grid: GridWidgetData = {
        items: [],
      };

      expect(isCollectionWidgetData(grid)).toBe(true);
    });

    it('should return true for CalendarWidgetData', () => {
      const calendar: CalendarWidgetData = {
        items: [],
      };

      expect(isCollectionWidgetData(calendar)).toBe(true);
    });

    it('should return true for DoubleColumnWidgetData', () => {
      const doubleColumn: DoubleColumnWidgetData = {
        items: [],
      };

      expect(isCollectionWidgetData(doubleColumn)).toBe(true);
    });

    it('should return true for SingleColumnWidgetData', () => {
      const singleColumn: SingleColumnWidgetData = {
        items: [],
      };

      expect(isCollectionWidgetData(singleColumn)).toBe(true);
    });

    it('should return true for VerticalTimelineWidgetData', () => {
      const timeline: VerticalTimelineWidgetData = {
        items: [],
      };

      expect(isCollectionWidgetData(timeline)).toBe(true);
    });

    it('should return false for SplashWidgetData', () => {
      const splash: SplashWidgetData = {
        variant: 'info',
        padding: 'lg',
        title: 'Test',
        overlay: true,
        overlayOpacity: 'medium',
      };

      expect(isCollectionWidgetData(splash)).toBe(false);
    });

    it('should return false for ReportWidgetData', () => {
      const report: ReportWidgetData = {
        report: {
          name: 'Test',
          title: 'Test',
          period: 'Year',
          goal: 'Test',
          categories: [],
        },
      };

      expect(isCollectionWidgetData(report)).toBe(false);
    });
  });

  describe('WidgetData Union Type', () => {
    it('should accept all widget data types', () => {
      const splash: WidgetData = {
        variant: 'info',
        padding: 'lg',
        title: 'Test',
        overlay: true,
        overlayOpacity: 'medium',
      };

      const grid: WidgetData = {
        items: [],
      };

      const calendar: WidgetData = {
        items: [],
      };

      const report: WidgetData = {
        report: {
          name: 'Test',
          title: 'Test',
          period: 'Year',
          goal: 'Test',
          categories: [],
        },
      };

      expect(splash).toBeDefined();
      expect(grid).toBeDefined();
      expect(calendar).toBeDefined();
      expect(report).toBeDefined();
    });
  });
});

