import { variantService } from '../services/variantService.js';
import { responseHandler } from '../utils/responseHandler.js';

class VariantController {
  createVariant = (req, res) => {
    try {
      const { productId } = req.params;
      const variant = variantService.createVariant(productId, req.body, req.user.id);
      return responseHandler.success(res, variant, 'Variant created successfully', 201);
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };

  updateVariant = (req, res) => {
    try {
      const { variantId } = req.params;
      const variant = variantService.updateVariant(variantId, req.body, req.user.id);
      return responseHandler.success(res, variant, 'Variant updated successfully');
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };

  deleteVariant = (req, res) => {
    try {
      const { variantId } = req.params;
      variantService.deleteVariant(variantId, req.user.id);
      return responseHandler.success(res, null, 'Variant deleted successfully');
    } catch (error) {
      return responseHandler.error(res, error.message, 400);
    }
  };
}

export const variantController = new VariantController();
