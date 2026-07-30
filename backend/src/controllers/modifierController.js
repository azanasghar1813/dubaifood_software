import { modifierService } from '../services/modifierService.js';
import { responseHandler } from '../utils/responseHandler.js';
import { modifierRepository } from '../repositories/modifierRepository.js';

class ModifierController {
  // --- Modifier Groups ---
  createGroup = (req, res) => {
    try {
      const group = modifierService.createGroup(req.body, req.user.id);
      return responseHandler.success(res, group, 'Modifier group created successfully', 201);
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };

  updateGroup = (req, res) => {
    try {
      const { groupId } = req.params;
      const group = modifierService.updateGroup(groupId, req.body, req.user.id);
      return responseHandler.success(res, group, 'Modifier group updated successfully');
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };

  deleteGroup = (req, res) => {
    try {
      const { groupId } = req.params;
      modifierService.deleteGroup(groupId, req.user.id);
      return responseHandler.success(res, null, 'Modifier group deleted successfully');
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };

  getAllGroups = (req, res) => {
    try {
      const groups = modifierRepository.findAllGroups();
      groups.forEach(g => {
        g.options = modifierRepository.getOptionsForGroup(g.id);
      });
      return responseHandler.success(res, groups, 'Modifier groups fetched');
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };

  // --- Modifiers ---
  createModifier = (req, res) => {
    try {
      const mod = modifierService.createModifier(req.body, req.user.id);
      return responseHandler.success(res, mod, 'Modifier created successfully', 201);
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };

  updateModifier = (req, res) => {
    try {
      const { modifierId } = req.params;
      const mod = modifierService.updateModifier(modifierId, req.body, req.user.id);
      return responseHandler.success(res, mod, 'Modifier updated successfully');
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };

  getAllModifiers = (req, res) => {
    try {
      const mods = modifierRepository.findAllModifiers();
      return responseHandler.success(res, mods, 'Modifiers fetched');
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };

  // --- Linking ---
  addOptionToGroup = (req, res) => {
    try {
      const { groupId, modifierId } = req.params;
      modifierService.addOptionToGroup(groupId, modifierId, req.body, req.user.id);
      return responseHandler.success(res, null, 'Option added to group', 201);
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };

  removeOptionFromGroup = (req, res) => {
    try {
      const { optionId } = req.params;
      modifierService.removeOptionFromGroup(optionId, req.user.id);
      return responseHandler.success(res, null, 'Option removed from group');
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };

  linkGroupToProduct = (req, res) => {
    try {
      const { productId, groupId } = req.params;
      const displayOrder = req.body.display_order || 0;
      modifierService.linkGroupToProduct(productId, groupId, displayOrder, req.user.id);
      return responseHandler.success(res, null, 'Group linked to product', 201);
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };

  unlinkGroupFromProduct = (req, res) => {
    try {
      const { productId, groupId } = req.params;
      modifierService.unlinkGroupFromProduct(productId, groupId, req.user.id);
      return responseHandler.success(res, null, 'Group unlinked from product');
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };
}

export const modifierController = new ModifierController();
