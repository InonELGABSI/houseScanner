import { Injectable } from '@nestjs/common';
import { ChecklistScope } from '@prisma/client';
import { PrismaService } from '../infra/orm/prisma.service';

interface ChecklistItem {
  id: string;
  title: string;
  type: string;
  description: string;
  options?: string[];
  subitems?: ChecklistItem[];
}

interface MergedChecklist {
  default?: {
    description: string;
    items: ChecklistItem[];
  };
  house_types?: Record<string, { description: string; items: ChecklistItem[] }>;
  room_types?: Record<string, { description: string; items: ChecklistItem[] }>;
  description?: string;
  items?: ChecklistItem[];
}

@Injectable()
export class ChecklistMergeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Merges base and custom checklists for a given user and scope.
   * Returns the final merged checklist ready to send to agents-service.
   */
  async getMergedChecklist(
    userId: string,
    scope: ChecklistScope,
  ): Promise<MergedChecklist> {
    // Get all enabled base checklists for this scope
    const baseChecklists = await this.prisma.checklist.findMany({
      where: {
        scope,
        isBase: true,
      },
      orderBy: { version: 'desc' },
    });

    // Get all custom checklists for this user and scope
    const customChecklists = await this.prisma.checklist.findMany({
      where: {
        scope,
        userId,
        isBase: false,
      },
      orderBy: { version: 'desc' },
    });

    // Start with base checklist
    let merged: MergedChecklist = {};

    if (baseChecklists.length > 0) {
      // Take the latest version of base checklist
      const latestBase = baseChecklists[0];
      merged = (latestBase.itemsRaw as MergedChecklist) || {};
    }

    // Merge custom checklists
    for (const custom of customChecklists) {
      const customItems = (custom.itemsRaw as MergedChecklist) || {};
      merged = this.deepMergeChecklists(merged, customItems);
    }

    return merged;
  }

  /**
   * Get all three merged checklists (house, rooms, products) for a user.
   */
  async getAllMergedChecklists(userId: string) {
    const [houseChecklist, roomsChecklist, productsChecklist] =
      await Promise.all([
        this.getMergedChecklist(userId, ChecklistScope.house),
        this.getMergedChecklist(userId, ChecklistScope.room),
        this.getMergedChecklist(userId, ChecklistScope.product),
      ]);

    return {
      house_checklist: houseChecklist,
      rooms_checklist: roomsChecklist,
      products_checklist: productsChecklist,
    };
  }

  /**
   * Deep merge two checklist objects.
   * Custom items override or extend base items.
   */
  private deepMergeChecklists(
    base: MergedChecklist,
    custom: MergedChecklist,
  ): MergedChecklist {
    const result = { ...base };

    // Merge default items
    if (custom.default?.items) {
      if (!result.default) {
        result.default = {
          description: custom.default.description || '',
          items: [],
        };
      }
      result.default.items = this.mergeItems(
        result.default.items,
        custom.default.items,
      );
    }

    // Merge house_types
    if (custom.house_types) {
      if (!result.house_types) {
        result.house_types = {};
      }
      for (const [typeKey, typeValue] of Object.entries(custom.house_types)) {
        if (!result.house_types[typeKey]) {
          result.house_types[typeKey] = typeValue;
        } else {
          result.house_types[typeKey].items = this.mergeItems(
            result.house_types[typeKey].items,
            typeValue.items,
          );
        }
      }
    }

    // Merge room_types
    if (custom.room_types) {
      if (!result.room_types) {
        result.room_types = {};
      }
      for (const [typeKey, typeValue] of Object.entries(custom.room_types)) {
        if (!result.room_types[typeKey]) {
          result.room_types[typeKey] = typeValue;
        } else {
          result.room_types[typeKey].items = this.mergeItems(
            result.room_types[typeKey].items,
            typeValue.items,
          );
        }
      }
    }

    // Merge flat items (for products)
    if (custom.items) {
      if (!result.items) {
        result.items = [];
      }
      result.items = this.mergeItems(result.items, custom.items);
    }

    return result;
  }

  /**
   * Merge two arrays of checklist items.
   * Items with the same ID are merged, new items are added.
   */
  private mergeItems(
    baseItems: ChecklistItem[],
    customItems: ChecklistItem[],
  ): ChecklistItem[] {
    const result = [...baseItems];
    const baseItemsMap = new Map(baseItems.map((item) => [item.id, item]));

    for (const customItem of customItems) {
      const existingIndex = result.findIndex(
        (item) => item.id === customItem.id,
      );

      if (existingIndex >= 0) {
        // Merge existing item
        result[existingIndex] = {
          ...result[existingIndex],
          ...customItem,
          // Merge subitems if they exist
          subitems: customItem.subitems
            ? this.mergeItems(
                result[existingIndex].subitems || [],
                customItem.subitems,
              )
            : result[existingIndex].subitems,
        };
      } else {
        // Add new custom item
        result.push(customItem);
      }
    }

    return result;
  }
}
