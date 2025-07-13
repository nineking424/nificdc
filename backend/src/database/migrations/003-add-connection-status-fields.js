'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('systems', 'last_connection_status', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: 'pending',
      comment: '마지막 연결 테스트 상태 (success, failed, pending)'
    });

    await queryInterface.addColumn('systems', 'last_connection_test', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: '마지막 연결 테스트 실행 시각'
    });

    await queryInterface.addColumn('systems', 'last_connection_message', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: '마지막 연결 테스트 결과 메시지'
    });

    await queryInterface.addColumn('systems', 'last_connection_latency', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: '마지막 연결 테스트 응답 시간 (ms)'
    });

    // 인덱스 추가 (연결 상태로 필터링하는 경우가 많을 것으로 예상)
    await queryInterface.addIndex('systems', ['last_connection_status']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('systems', ['last_connection_status']);
    await queryInterface.removeColumn('systems', 'last_connection_latency');
    await queryInterface.removeColumn('systems', 'last_connection_message');
    await queryInterface.removeColumn('systems', 'last_connection_test');
    await queryInterface.removeColumn('systems', 'last_connection_status');
  }
};