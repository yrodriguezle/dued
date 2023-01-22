import logger from '../../common/logger';

const bootstrap = () => () => {
  logger.log('bootstrap');
};

export default bootstrap;
